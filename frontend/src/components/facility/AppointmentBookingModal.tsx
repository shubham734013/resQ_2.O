import { useState } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, ShieldAlert, Building2 } from 'lucide-react';
import type { Facility } from '../../types/facility';
import { useAppointmentAvailability, useBookAppointment } from '../../hooks/useHospitalAppointments';
import { Button } from '../common/Button';
import { useNavigate } from 'react-router-dom';

interface AppointmentBookingModalProps {
  facility: Facility;
  isOpen: boolean;
  onClose: () => void;
  onSwitchToCareRequest?: () => void;
}

// Format a calendar date in the user's local timezone (not UTC).
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to format tomorrow's date YYYY-MM-DD using local calendar time.
const getDefaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
};

export const AppointmentBookingModal = ({
  facility,
  isOpen,
  onClose,
  onSwitchToCareRequest,
}: AppointmentBookingModalProps) => {
  const navigate = useNavigate();
  const bookMutation = useBookAppointment();

  const availableDepts = facility.departments && facility.departments.length > 0
    ? facility.departments
    : facility.capabilities && facility.capabilities.length > 0
    ? facility.capabilities
    : ['General Medicine'];

  const [department, setDepartment] = useState(availableDepts[0] || 'General Medicine');
  const [selectedDate, setSelectedDate] = useState(getDefaultDate());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [visitReason, setVisitReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);

  // Availability query
  const { data: availability, isLoading: isCheckingSlots, refetch: refetchSlots } = useAppointmentAvailability(
    facility.id,
    department,
    selectedDate,
    isOpen
  );

  if (!isOpen) return null;

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedTime) {
      setErrorMessage('Please select an available appointment time slot.');
      return;
    }
    if (visitReason.trim().length < 3) {
      setErrorMessage('Please enter the reason for your appointment (at least 3 characters).');
      return;
    }

    bookMutation.mutate(
      {
        hospitalId: facility.id,
        department,
        date: selectedDate,
        startTime: selectedTime,
        visitReason: visitReason.trim(),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setConfirmedCode(data.appointmentCode);
        },
        onError: (err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to reserve appointment.');
          // Refresh slots in case the selected slot was taken
          refetchSlots();
        },
      }
    );
  };

  const handleReset = () => {
    setConfirmedCode(null);
    setSelectedTime(null);
    setVisitReason('');
    setNotes('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Book Hospital Appointment</h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{facility.name}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Emergency Safety Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Scheduled Appointment</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Appointments are reserved for routine consultations. In case of acute medical emergencies, tap Emergency SOS.
              </p>
            </div>
          </div>

          {confirmedCode ? (
            /* Confirmation Screen */
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Appointment Reserved!</h3>
                <p className="text-xs text-slate-500">
                  Your appointment slot has been reserved. Hospital staff will confirm your booking.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-sm mx-auto space-y-2 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Appointment Code:</span>
                  <span className="font-mono font-bold text-slate-800">{confirmedCode}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Hospital:</span>
                  <span className="font-medium text-slate-800">{facility.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-medium text-slate-800">{department}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Date & Time:</span>
                  <span className="font-bold text-indigo-700">{selectedDate} at {selectedTime}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Initial Status:</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full">PENDING CONFIRMATION</span>
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-center">
                <Button variant="secondary" size="md" onClick={handleReset}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    handleReset();
                    navigate('/appointments');
                  }}
                >
                  View My Appointments
                </Button>
              </div>
            </div>
          ) : (
            /* Booking Form */
            <form onSubmit={handleBooking} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Department & Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Department</label>
                  <select
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setSelectedTime(null);
                    }}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    {availableDepts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Appointment Date</label>
                  <input
                    type="date"
                    min={formatLocalDate(new Date())}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTime(null);
                    }}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Available Slots Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Available Time Slots</span>
                  </label>
                  {isCheckingSlots && (
                    <span className="text-[11px] text-slate-400 animate-pulse">Checking availability...</span>
                  )}
                </div>

                {availability?.isConfigured === false ? (
                  /* Not Configured State */
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                    <p className="text-xs text-slate-600">
                      Appointment slots are not scheduled for <span className="font-semibold">{department}</span> at this facility.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      You can send a direct care request instead!
                    </p>
                    {onSwitchToCareRequest && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={onSwitchToCareRequest}
                        icon={<Building2 className="w-3.5 h-3.5" />}
                      >
                        Switch to Direct Care Request
                      </Button>
                    )}
                  </div>
                ) : availability?.isBlackout ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    The clinic is closed on {selectedDate} (holiday/blackout date). Please select another date.
                  </div>
                ) : availability?.isDayOff ? (
                  <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600">
                    The {department} department does not operate on this day of the week. Please select another date.
                  </div>
                ) : availability?.slots && availability.slots.length > 0 ? (
                  /* Slot Selector Grid */
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                    {availability.slots.map((slot) => {
                      const isSelected = selectedTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => setSelectedTime(slot.startTime)}
                          className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : slot.isAvailable
                              ? 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-800'
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <div>{slot.startTime}</div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-100' : slot.isAvailable ? 'text-slate-500' : 'text-slate-400'}`}>
                            {slot.isAvailable ? `${slot.availableCapacity} left` : 'Booked'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                    No slots available for this date. Please select another date.
                  </div>
                )}
              </div>

              {/* Reason for Visit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Reason for Visit</label>
                <textarea
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for visit (e.g., routine cardiac checkup, prescription renewal)..."
                  className="w-full p-3 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Notes / Doctor Instructions (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any accessibility requirements or doctor preferences..."
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" size="md" onClick={onClose} type="button">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={bookMutation.isPending || !selectedTime || !availability?.isConfigured}
                  icon={<Calendar className="w-4 h-4" />}
                >
                  {bookMutation.isPending ? 'Reserving Slot...' : 'Confirm Booking'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
