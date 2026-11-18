import { Calendar, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { hospitalAppointmentApi, type HospitalAppointment } from '../../services/hospitalAppointmentApi';
import { StatusBadge } from '../../components/common/StatusBadge';

export const AdminAppointmentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const appointments = useQuery({
    queryKey: ['admin-appointments-registry'],
    queryFn: () => hospitalAppointmentApi.listHospitalAppointments({ limit: 100 }),
  });

  const items = appointments.data?.items ?? [];
  const list = items.filter((item: HospitalAppointment) => {
    const hosp = typeof item.hospitalId === 'object' && item.hospitalId ? item.hospitalId.name : '';
    const dept = item.serviceDepartment || '';
    return hosp.toLowerCase().includes(searchTerm.toLowerCase()) || dept.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">System-wide Appointments & Care Requests</h1>
          <p className="text-xs text-slate-500">Master registry of routine hospital slots, clinical reservations, and concurrency-safe bookings</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by hospital or clinic department…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-xs focus:border-slate-800 outline-none"
          />
        </div>

        {appointments.isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading appointments registry…</div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No appointments matching criteria</p>
            <p className="text-xs text-slate-400 mt-1">Direct bookings across verified facilities will appear here in real time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="pb-3">Facility</th>
                  <th className="pb-3">Department / Service</th>
                  <th className="pb-3">Slot Date & Time</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((item: HospitalAppointment) => {
                  const facilityName = typeof item.hospitalId === 'object' && item.hospitalId ? item.hospitalId.name : 'Hospital Facility';
                  return (
                    <tr key={item._id} className="hover:bg-slate-50/80">
                      <td className="py-3 font-semibold text-slate-900">{facilityName}</td>
                      <td className="py-3 text-slate-700">{item.serviceDepartment}</td>
                      <td className="py-3 text-slate-600">{item.slotDate} &bull; {item.startTime} - {item.endTime}</td>
                      <td className="py-3">
                        <StatusBadge
                          variant={item.status === 'CONFIRMED' ? 'verified' : item.status === 'PENDING' ? 'waitTime' : 'neutral'}
                          label={item.status}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
