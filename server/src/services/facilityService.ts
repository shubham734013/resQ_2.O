import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { facilitySearchQuerySchema } from '../schemas/facility.js';

type FacilitySearchQuery = z.infer<typeof facilitySearchQuerySchema>;

const categoryFor = (hospital: { hospitalType: string; services: string[]; capabilities: string[] }): 'emergency' | 'trauma' | 'urgent_care' | 'pediatric' => {
  const text=[hospital.hospitalType,...hospital.services,...hospital.capabilities].join(' ').toLowerCase();
  if(text.includes('trauma'))return 'trauma';
  if(text.includes('pediatric')||text.includes('paediatric'))return 'pediatric';
  if(text.includes('urgent'))return 'urgent_care';
  return 'emergency';
};

export const hospitalToFacility = (hospital: Record<string, unknown>, distanceMeters?: unknown) => {
  const location=hospital.location as {coordinates?:[number,number]}|undefined;
  const latitude=location?.coordinates?.[1];
  const longitude=location?.coordinates?.[0];
  const meters=typeof distanceMeters==='number'&&Number.isFinite(distanceMeters)?distanceMeters:undefined;
  return {
    id:String(hospital._id),name:String(hospital.name),type:String(hospital.hospitalType),
    category:categoryFor(hospital as {hospitalType:string;services:string[];capabilities:string[]}),
    distance:meters===undefined?'':meters>=1000?(`${(meters/1000).toFixed(1)} km`):(`${Math.round(meters)} m`),
    distanceMeters:meters,
    estimatedTime:'',
    emergencyAvailable:hospital.emergencyAvailability==='AVAILABLE',
    verified:hospital.verificationStatus==='VERIFIED',
    lastUpdated:new Date(String(hospital.updatedAt)).toISOString(),
    latitude:typeof latitude==='number'?latitude:undefined,
    longitude:typeof longitude==='number'?longitude:undefined,
    address:[hospital.address,hospital.city,hospital.state,hospital.country].filter((v):v is string=>typeof v==='string'&&v.length>0).join(', '),
    phone:String(hospital.phone??''),openStatus:hospital.emergencyAvailability==='UNAVAILABLE'?'Emergency unavailable':'Emergency availability',
    isOpen:hospital.accountStatus==='ACTIVE',isAvailable:hospital.emergencyAvailability!=='UNAVAILABLE',
    capabilities:Array.isArray(hospital.capabilities)?hospital.capabilities.filter((v):v is string=>typeof v==='string'):[]
  };
};

export const searchFacilities=async(query:FacilitySearchQuery)=>{
  const baseFilter:Record<string,unknown>={accountStatus:'ACTIVE',verificationStatus:'VERIFIED',location:{$exists:true}};
  if(query.emergencyOnly)baseFilter.emergencyAvailability='AVAILABLE';
  if(query.category!=='all'){
    const categoryMap:Record<string,RegExp>={emergency:/emergency|critical/i,trauma:/trauma/i,urgent_care:/urgent/i,pediatric:/pediatric|paediatric/i};
    const categoryFilter={$or:[{hospitalType:categoryMap[query.category]},{services:categoryMap[query.category]},{capabilities:categoryMap[query.category]}]};
    Object.assign(baseFilter,categoryFilter);
  }
  if(query.q){
    const text=new RegExp(query.q.replace(/[.*+?^()|[\]\\]/g,'\\$&'),'i');
    baseFilter.$and=[{$or:[{name:text},{address:text},{city:text},{state:text},{services:text},{capabilities:text}]}];
  }
  if(query.latitude!==undefined&&query.longitude!==undefined){
    const pipeline=[
      {$geoNear:{near:{type:'Point',coordinates:[query.longitude,query.latitude]},key:'location',distanceField:'distanceMeters',spherical:true,maxDistance:query.radiusMeters,query:baseFilter}},
      {$facet:{
        items:[{$sort:{distanceMeters:1,updatedAt:-1}},{$skip:(query.page-1)*query.limit},{$limit:query.limit}],
        total:[{$count:'count'}],
      }},
    ];
    const [result]=await HospitalModel.aggregate<{items:Array<Record<string,unknown>&{distanceMeters?:number}>;total:Array<{count:number}]}>(pipeline).exec();
    const items=result?.items??[],total=result?.total[0]?.count??0;
    return {items:items.map(item=>hospitalToFacility(item,item.distanceMeters)),pagination:{page:query.page,limit:query.limit,total,totalPages:total?Math.ceil(total/query.limit):0}};
  }
  const [items,total]=await Promise.all([
    HospitalModel.find(baseFilter).select('-passwordHash -email').sort({updatedAt:-1}).skip((query.page-1)*query.limit).limit(query.limit).lean().exec(),
    HospitalModel.countDocuments(baseFilter).exec()
  ]);
  return {items:items.map(item=>hospitalToFacility(item)),pagination:{page:query.page,limit:query.limit,total,totalPages:total?Math.ceil(total/query.limit):0}};
};

export const getFacility=async(id:string)=>{
  if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID','Invalid facility id',400);
  const hospital=await HospitalModel.findOne({_id:id,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('-passwordHash -email').lean().exec();
  if(!hospital)throw new AppError('NOT_FOUND','Facility not found',404);
  return hospitalToFacility(hospital as unknown as Record<string,unknown>);
};