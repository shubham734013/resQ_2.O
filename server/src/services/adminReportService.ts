import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { EmergencyRequestModel, type HospitalEmergencyStatus } from '../models/EmergencyRequest.js';
import { HospitalModel } from '../models/Hospital.js';

export interface ReportRange { from?: Date; to?: Date; }
export const REPORT_STATUSES: HospitalEmergencyStatus[] = ['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION','RESOLVED','CANCELLED'];

const emergencyMatch = (range: ReportRange) => ({
  ...(range.from || range.to ? { reportedAt: { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) } } : {}),
});

const dateBucket = { $dateToString: { format: '%Y-%m-%d', date: '$reportedAt', timezone: 'UTC' } };

const zeroStatus = () => Object.fromEntries(REPORT_STATUSES.map((status) => [status, 0])) as Record<HospitalEmergencyStatus, number>;

export const getReportOverview = async (range: ReportRange) => {
  const [emergency, hospitals, providers, ambulances, drivers] = await Promise.all([
    EmergencyRequestModel.aggregate<{ _id: HospitalEmergencyStatus; count: number }>([
      { $match: emergencyMatch(range) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec(),
    Promise.all([HospitalModel.countDocuments(), HospitalModel.countDocuments({ verificationStatus: 'VERIFIED' })]),
    Promise.all([AmbulanceProviderModel.countDocuments(), AmbulanceProviderModel.countDocuments({ verificationStatus: 'VERIFIED' })]),
    Promise.all([
      AmbulanceModel.countDocuments(),
      AmbulanceModel.countDocuments({ currentStatus: 'AVAILABLE' }),
      AmbulanceModel.countDocuments({ currentStatus: 'BUSY' }),
      AmbulanceModel.countDocuments({ currentStatus: 'OFFLINE' }),
      AmbulanceModel.countDocuments({ currentStatus: 'MAINTENANCE' }),
      AmbulanceDriverModel.countDocuments({ assignedAmbulanceId: { $exists: true, $ne: null } }),
    ]),
    Promise.all([
      AmbulanceDriverModel.countDocuments(),
      AmbulanceDriverModel.countDocuments({ availabilityStatus: 'ONLINE' }),
      AmbulanceDriverModel.countDocuments({ availabilityStatus: 'BUSY' }),
      AmbulanceDriverModel.countDocuments({ availabilityStatus: 'OFFLINE' }),
    ]),
  ]);

  const status = zeroStatus();
  emergency.forEach((row) => { status[row._id] = row.count; });
  const totalRequests = emergency.reduce((sum, row) => sum + row.count, 0);
  const activeRequests = status.RECEIVED + status.REVIEWING + status.PREPARING + status.AMBULANCE_COORDINATION;

  return {
    range: { from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
    emergencies: { totalRequests, activeRequests, received: status.RECEIVED, resolved: status.RESOLVED, cancelled: status.CANCELLED },
    hospitals: { total: hospitals[0], verified: hospitals[1] },
    ambulanceProviders: { total: providers[0], verified: providers[1] },
    ambulances: { total: ambulances[0], available: ambulances[1], busy: ambulances[2], offline: ambulances[3], maintenance: ambulances[4], unassigned: ambulances[0] - ambulances[5] },
    drivers: { total: drivers[0], online: drivers[1], busy: drivers[2], offline: drivers[3] },
  };
};

export const getEmergencyReports = async (range: ReportRange) => {
  const match = emergencyMatch(range);
  const [trend, statusRows, situations, hospitals] = await Promise.all([
    EmergencyRequestModel.aggregate<{ _id: string; value: number }>([
      { $match: match }, { $group: { _id: dateBucket, value: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]).exec(),
    EmergencyRequestModel.aggregate<{ _id: HospitalEmergencyStatus; value: number }>([
      { $match: match }, { $group: { _id: '$status', value: { $sum: 1 } } }, { $sort: { value: -1, _id: 1 } },
    ]).exec(),
    EmergencyRequestModel.aggregate<{ _id: string; value: number }>([
      { $match: match }, { $group: { _id: '$situationType', value: { $sum: 1 } } }, { $sort: { value: -1, _id: 1 } },
    ]).exec(),
    EmergencyRequestModel.aggregate<{ _id: unknown; name: string; value: number }>([
      { $match: match },
      { $group: { _id: '$hospitalId', value: { $sum: 1 } } },
      { $lookup: { from: 'hospitals', localField: '_id', foreignField: '_id', as: 'hospital' } },
      { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: { $ifNull: ['$hospital.name', 'Unknown hospital'] }, value: 1 } },
      { $sort: { value: -1, name: 1 } },
    ]).exec(),
  ]);

  const status = REPORT_STATUSES.map((name) => ({ _id: name, value: statusRows.find((row) => row._id === name)?.value ?? 0 }));
  return { trend, status, situations, hospitals };
};

export const getOperationalAnalytics = async (range: ReportRange) => {
  const match = emergencyMatch(range);
  const scopedAmbulanceMatch = range.from || range.to ? { updatedAt: { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) } } : {};
  const [resolutionRows, responseRows, ambulanceStatus, providerFleet, hospitalActivity] = await Promise.all([
    EmergencyRequestModel.aggregate<{ total: number; resolved: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } } } },
      { $project: { _id: 0, total: 1, resolved: 1 } },
    ]).exec(),
    EmergencyRequestModel.aggregate<{ averageMinutes: number; samples: number }>([
      { $match: { ...match, 'statusHistory.status': 'REVIEWING' } },
      { $project: {
        reportedAt: 1,
        reviewingAt: {
          $let: {
            vars: { review: { $filter: { input: '$statusHistory', as: 'h', cond: { $eq: ['$$h.status', 'REVIEWING'] } } } },
            in: { $arrayElemAt: ['$$review.changedAt', 0] },
          },
        },
      } },
      { $match: { reviewingAt: { $type: 'date' } } },
      { $group: { _id: null, averageMinutes: { $avg: { $divide: [{ $subtract: ['$reviewingAt', '$reportedAt'] }, 60000] } }, samples: { $sum: 1 } } },
      { $project: { _id: 0, averageMinutes: 1, samples: 1 } },
    ]).exec(),
    AmbulanceModel.aggregate<{ _id: string; value: number }>([
      { $match: scopedAmbulanceMatch }, { $group: { _id: '$currentStatus', value: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]).exec(),
    AmbulanceProviderModel.aggregate<{ id: string; name: string; value: number }>([
      { $lookup: { from: 'ambulances', localField: '_id', foreignField: 'providerId', as: 'fleet' } },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, value: { $size: '$fleet' } } },
      { $sort: { value: -1, name: 1 } },
    ]).exec(),
    EmergencyRequestModel.aggregate<{ id: string; name: string; value: number }>([
      { $match: match },
      { $group: { _id: '$hospitalId', value: { $sum: 1 } } },
      { $lookup: { from: 'hospitals', localField: '_id', foreignField: '_id', as: 'hospital' } },
      { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: { $ifNull: ['$hospital.name', 'Unknown hospital'] }, value: 1 } },
      { $sort: { value: -1, name: 1 } },
    ]).exec(),
  ]);

  const total = resolutionRows[0]?.total ?? 0;
  const resolved = resolutionRows[0]?.resolved ?? 0;
  return {
    resolutionRatio: total > 0 ? resolved / total : null,
    responseToReview: responseRows[0] ?? { averageMinutes: null, samples: 0 },
    ambulanceStatus: ambulanceStatus.map((row) => ({ label: row._id, value: row.value })),
    providerFleet: providerFleet.map((row) => ({ label: row.name, id: row.id, value: row.value })),
    hospitalActivity: hospitalActivity.map((row) => ({ label: row.name, id: row.id, value: row.value })),
  };
};

export const getExportRows = async (range: ReportRange) => {
  const rows = await EmergencyRequestModel.aggregate<{
    _id: string;
    total: number;
    RECEIVED: number;
    REVIEWING: number;
    PREPARING: number;
    AMBULANCE_COORDINATION: number;
    RESOLVED: number;
    CANCELLED: number;
  }>([
    { $match: emergencyMatch(range) },
    {
      $group: {
        _id: dateBucket,
        total: { $sum: 1 },
        RECEIVED: { $sum: { $cond: [{ $eq: ['$status', 'RECEIVED'] }, 1, 0] } },
        REVIEWING: { $sum: { $cond: [{ $eq: ['$status', 'REVIEWING'] }, 1, 0] } },
        PREPARING: { $sum: { $cond: [{ $eq: ['$status', 'PREPARING'] }, 1, 0] } },
        AMBULANCE_COORDINATION: { $sum: { $cond: [{ $eq: ['$status', 'AMBULANCE_COORDINATION'] }, 1, 0] } },
        RESOLVED: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
        CANCELLED: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();
  return rows;
};

export const __private = { emergencyMatch, dateBucket };
