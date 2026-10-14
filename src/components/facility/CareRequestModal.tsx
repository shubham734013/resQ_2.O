import { useState } from 'react';
import { X, AlertCircle, CheckCircle2, Send, ShieldAlert, Clock, Building2 } from 'lucide-react';
import type { Facility } from '../../types/facility';
import { useCreateCareRequest } from '../../hooks/useHospitalCareRequests';
import type { CareRequestType, PreferredTiming, ContactPreference } from '../../services/hospitalCareRequestApi';
import { Button } from '../common/Button';
import { useNavigate } from 'react-router-dom';

interface CareRequestModalProps {
  facility: Facility;
  isOpen: boolean;
  onClose: () => void;
}

export const CareRequestModal = ({ facility, isOpen, onClose }: CareRequestModalProps) => {
  const navigate = useNavigate();
  const createMutation = useCreateCareRequest();

  const availableDepts = facility.departments && facility.departments.length > 0
    ? facility.departments
    : facility.capabilities && facility.capabilities.length > 0
    ? facility.capabilities
    : ['General Medicine'];

  const [department, setDepartment] = useState(availableDepts[0] || 'General Medicine');
  const [requestType, setRequestType] = useState<CareRequestType>('GENERAL_CONSULTATION');
  const [visitReason, setVisitReason] = useState('');
  const [preferredTiming, setPreferredTiming] = useState<PreferredTiming>('FLEXIBLE');
  const [contactPreference, setContactPreference] = useState<ContactPreference>('IN_APP');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdReferenceId, setCreatedReferenceId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (visitReason.trim().length < 3) {
      setErrorMessage('Please provide a brief reason for your visit (at least 3 characters).');
      return;
    }

    createMutation.mutate(
      {
        hospitalId: facility.id,
        serviceDepartment: department,
        requestType,
        visitReason: visitReason.trim(),
        preferredTiming,
        contactPreference,
      },
      {
        onSuccess: (data) => {
          setCreatedReferenceId(data.referenceId);
        },
        onError: (err) => {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to submit care request.');
        },
      }
    );
  };

  const handleReset = () => {
    setCreatedReferenceId(null);
    setVisitReason('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Direct Care Request</h2>
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
              <span className="font-semibold">Non-Emergency Workflow</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This form is for routine and non-urgent consultations only. If you are experiencing a life-threatening medical emergency, please use Emergency SOS.
              </p>
            </div>
          </div>

          {createdReferenceId ? (
            /* Success Receipt */
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Request Submitted Successfully</h3>
                <p className="text-xs text-slate-500">
                  {facility.name} has received your request and will review it shortly.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-sm mx-auto space-y-2 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Reference ID:</span>
                  <span className="font-mono font-bold text-slate-800">{createdReferenceId}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-medium text-slate-800">{department}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Status:</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full">PENDING</span>
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-center">
                <Button variant="secondary" size="md" onClick={handleReset}>
                  Done
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    handleReset();
                    navigate('/appointments');
                  }}
                >
                  View My Requests
                </Button>
              </div>
            </div>
          ) : (
            /* Request Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Department / Clinical Service</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {availableDepts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Request Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Type of Consultation</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as CareRequestType)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="GENERAL_CONSULTATION">General Consultation</option>
                  <option value="SPECIALIST_CONSULTATION">Specialist Consultation</option>
                  <option value="DIAGNOSTIC">Diagnostic / Lab Service</option>
                  <option value="FOLLOW_UP">Follow-up Visit</option>
                  <option value="ROUTINE_CHECKUP">Routine Health Checkup</option>
                  <option value="OTHER">Other Health Inquiry</option>
                </select>
              </div>

              {/* Reason for Visit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Reason for Request</label>
                <textarea
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe your symptoms or reason for visit (non-emergency only)..."
                  className="w-full p-3 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                  required
                />
              </div>

              {/* Preferred Timing & Contact Preference Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Preferred Timing</span>
                  </label>
                  <select
                    value={preferredTiming}
                    onChange={(e) => setPreferredTiming(e.target.value as PreferredTiming)}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  >
                    <option value="FLEXIBLE">Flexible / Any Time</option>
                    <option value="MORNING">Morning (09:00 - 12:00)</option>
                    <option value="AFTERNOON">Afternoon (12:00 - 16:00)</option>
                    <option value="EVENING">Evening (16:00 - 20:00)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Contact Preference</label>
                  <select
                    value={contactPreference}
                    onChange={(e) => setContactPreference(e.target.value as ContactPreference)}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  >
                    <option value="IN_APP">In-App Notification</option>
                    <option value="PHONE">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button variant="secondary" size="md" onClick={onClose} type="button">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={createMutation.isPending}
                  icon={<Send className="w-4 h-4" />}
                >
                  {createMutation.isPending ? 'Submitting...' : 'Send Request'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
