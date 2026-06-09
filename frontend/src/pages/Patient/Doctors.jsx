import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import PatientLayout from "./components/PatientLayout";
import {
  getDoctors,
  getDoctorById,
  createAppointment,
  initiatePayment,
  uploadReceipt,
  verifyChapaPayment,
  getDoctorBookedSlots,
} from "../../services/patientService";

const specialties = [
  "All",
  "Cardiology",
  "General Practice",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Orthopedics",
  "Psychiatry",
  "Endocrinology",
  "Radiology",
  "Oncology",
  "Gynecology",
  "Ophthalmology",
  "ENT",
  "Urology",
  "Nephrology",
  "Nutritionist",
  "Gym Trainer",
];

const statusColors = {
  available: "bg-emerald-100 text-emerald-700",
  busy: "bg-amber-100 text-amber-700",
};

function DoctorModal({ doctor: initialDoctor, onClose, onBookingSuccess }) {
  const [showBooking, setShowBooking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [booked, setBooked] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [doctor, setDoctor] = useState(initialDoctor);
  const [availableSlots, setAvailableSlots] = useState([]);

  // Fetch full doctor details including availability when modal opens
  useEffect(() => {
    const fetchDoctorDetails = async () => {
      const doctorId = initialDoctor._id || initialDoctor.id;
      if (doctorId) {
        const result = await getDoctorById(doctorId);
        if (result.data) {
          setDoctor(result.data);
        }
      }
    };
    fetchDoctorDetails();
  }, [initialDoctor]);

  // Get available time slots based on selected date and doctor's availability
  // Also checks for already booked slots to prevent double-booking
  // Includes real-time polling every 5 seconds and refresh on window focus
  useEffect(() => {
    let intervalId;

    const fetchAvailableSlots = async () => {
      // Must have both date and availability data
      if (
        !selectedDate ||
        !doctor.availability ||
        doctor.availability.length === 0
      ) {
        setAvailableSlots([]);
        return;
      }

      // Parse date manually to avoid timezone issues
      const [year, month, day] = selectedDate.split("-").map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayNames[date.getDay()];

      // Find availability for the selected day
      const dayAvailability = doctor.availability.find(
        (a) => a.day === dayName,
      );

      if (
        !dayAvailability ||
        !dayAvailability.slots ||
        dayAvailability.slots.length === 0
      ) {
        setAvailableSlots([]);
        setSelectedTime("");
        return;
      }

      // Get already booked slots for this doctor on this date
      const doctorId = doctor._id || doctor.id;
      try {
        const bookedResult = await getDoctorBookedSlots(doctorId, selectedDate);
        const bookedSlots = bookedResult.data?.bookedSlots || [];

        // Filter out already booked slots
        const available = dayAvailability.slots.filter(
          (slot) => !bookedSlots.includes(slot),
        );
        setAvailableSlots((_prev) => {
          // If currently selected time is now booked, deselect it
          if (selectedTime && bookedSlots.includes(selectedTime)) {
            setSelectedTime("");
          }
          return available;
        });
      } catch (_err) {
        // If booked slots API fails, show all available slots from doctor's schedule
        setAvailableSlots(dayAvailability.slots);
      }
    };

    // Initial fetch
    fetchAvailableSlots();

    // Set up polling every 5 seconds for real-time updates
    intervalId = setInterval(fetchAvailableSlots, 5000);

    // Refresh when window regains focus (user returns to tab)
    const handleFocus = () => {
      fetchAvailableSlots();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedDate, doctor.availability, doctor._id, doctor.id, selectedTime]);

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) {
      return;
    }

    if (!paymentMethod) {
      setError("Please select a payment method");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create appointment - convert 12-hour time to 24-hour format
      const convertTo24Hour = (time12h) => {
        const [time, period] = time12h.split(" ");
        let [hours, minutes] = time.split(":");
        hours = parseInt(hours, 10);
        if (period === "PM" && hours !== 12) {
          hours += 12;
        } else if (period === "AM" && hours === 12) {
          hours = 0;
        }
        return { hours, minutes: parseInt(minutes, 10) };
      };

      const { hours, minutes } = convertTo24Hour(selectedTime);
      const [year, month, day] = selectedDate.split("-").map(Number);

      // Create date in local timezone (preserves the selected time)
      const scheduledAt = new Date(year, month - 1, day, hours, minutes);

      console.log("Creating appointment:", {
        doctor: doctor._id || doctor.id,
        scheduled_at: scheduledAt.toISOString(),
        localTime: selectedTime,
      });

      const apptResult = await createAppointment({
        doctor: doctor._id || doctor.id,
        scheduled_at: scheduledAt.toISOString(),
      });

      // Handle conflict - slot already booked
      if (apptResult.error) {
        if (
          apptResult.error.includes("already been booked") ||
          apptResult.error.includes("409")
        ) {
          setError(
            "This time slot was just booked by another patient. Please select a different time.",
          );
          // Refresh available slots immediately
          const bookedResult = await getDoctorBookedSlots(
            doctor._id || doctor.id,
            selectedDate,
          );
          const bookedSlots = bookedResult.data?.bookedSlots || [];
          const [y, m, d] = selectedDate.split("-").map(Number);
          const date = new Date(y, m - 1, d);
          const dayNames = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ];
          const dayName = dayNames[date.getDay()];
          const dayAvailability = doctor.availability.find(
            (a) => a.day === dayName,
          );
          if (dayAvailability && dayAvailability.slots) {
            const available = dayAvailability.slots.filter(
              (slot) => !bookedSlots.includes(slot),
            );
            setAvailableSlots(available);
            setSelectedTime("");
          }
          setLoading(false);
          return;
        }
        throw new Error(apptResult.error);
      }

      setAppointment(apptResult.data);

      // Initiate payment
      const paymentResult = await initiatePayment({
        doctor: doctor._id || doctor.id,
        appointment: apptResult.data._id,
        amount: doctor.consultation_fee || doctor.fee,
        gateway: paymentMethod,
      });

      if (paymentResult.error) {
        setError(paymentResult.error);
        setLoading(false);
        return;
      }

      setPayment(paymentResult.data.payment);

      // If Chapa, redirect to payment page
      if (paymentMethod === "chapa") {
        const chapaUrl = paymentResult.data.checkout_url;

        if (!chapaUrl) {
          setError("Failed to get Chapa checkout URL");
          setLoading(false);
          return;
        }

        // Store payment info for verification after redirect
        localStorage.setItem(
          "pendingPayment",
          JSON.stringify({
            paymentId: paymentResult.data.payment._id,
            tx_ref: paymentResult.data.tx_ref,
            appointmentId: apptResult.data._id,
          }),
        );

        // Redirect to Chapa checkout
        console.log("Redirecting to:", chapaUrl);
        window.location.href = chapaUrl;
      } else {
        // For receipt upload, show upload form
        setShowPayment(true);
      }

      setLoading(false);
    } catch (err) {
      console.error("handleBook error:", err);
      setError(err.message || "Failed to book appointment");
      setLoading(false);
    }
  };

  const handleReceiptUpload = async () => {
    if (!receiptFile) {
      setError("Please select a receipt file");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await uploadReceipt(payment._id, receiptFile);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setBooked(true);
      setLoading(false);

      setTimeout(() => {
        setBooked(false);
        onBookingSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to upload receipt");
      setLoading(false);
    }
  };

  const handleVerifyChapaPayment = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await verifyChapaPayment(payment.tx_ref);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setBooked(true);
      setLoading(false);

      setTimeout(() => {
        setBooked(false);
        onBookingSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to verify payment");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#E05C8A] to-[#F4845F] p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <span className="material-symbols-outlined text-white text-lg">
              close
            </span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-3xl">
                person
              </span>
            </div>
            <div>
              <h3 className="font-black text-xl">
                {doctor.user?.full_name || doctor.name}
              </h3>
              <p className="text-white/80 text-sm">{doctor.specialty}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`material-symbols-outlined text-sm ${i < Math.floor(doctor.rating) ? "text-yellow-300" : "text-white/30"}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  ))}
                </div>
                <span className="text-white/80 text-xs">
                  {doctor.rating} (
                  {doctor.years_experience
                    ? `${doctor.years_experience} yrs exp`
                    : "Experienced"}
                  )
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {booked ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-emerald-600 text-3xl">
                  check_circle
                </span>
              </div>
              <p className="font-black text-gray-800 text-lg">
                Appointment Booked!
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {selectedDate} at {selectedTime}
              </p>
            </div>
          ) : showPayment ? (
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800">Complete Payment</h4>

              {paymentMethod === "receipt_upload" ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Upload your payment receipt to complete the booking.
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files[0])}
                      className="hidden"
                      id="receipt-upload"
                    />
                    <label
                      htmlFor="receipt-upload"
                      className="cursor-pointer block"
                    >
                      <span className="material-symbols-outlined text-4xl text-gray-400">
                        upload_file
                      </span>
                      <p className="text-sm text-gray-600 mt-2">
                        {receiptFile
                          ? receiptFile.name
                          : "Click to upload receipt"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        JPEG, PNG, or PDF (max 5MB)
                      </p>
                    </label>
                  </div>
                  {error && (
                    <p className="text-red-500 text-xs mt-2">{error}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Complete your payment via Chapa to confirm the booking.
                  </p>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 mb-3">
                    <span className="font-bold">Transaction Reference:</span>{" "}
                    {payment?.tx_ref}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    After completing payment, click the button below to verify.
                  </p>
                  {error && (
                    <p className="text-red-500 text-xs mb-2">{error}</p>
                  )}
                </div>
              )}
            </div>
          ) : !showBooking ? (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">
                {doctor.bio ||
                  "Experienced healthcare professional dedicated to providing quality patient care."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: "work_history",
                    label: "Experience",
                    value: doctor.years_experience
                      ? `${doctor.years_experience} Years`
                      : "Experienced",
                  },
                  {
                    icon: "payments",
                    label: "Consultation Fee",
                    value: `${doctor.consultation_fee || doctor.fee} ETB`,
                  },
                  {
                    icon: "local_hospital",
                    label: "Hospital",
                    value: doctor.hospital || "Available",
                  },
                  {
                    icon: "verified",
                    label: "Status",
                    value: doctor.is_verified ? "Verified" : "Pending",
                  },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="p-3 bg-[#fff5f7]/40 rounded-xl">
                    <span className="material-symbols-outlined text-[#E05C8A] text-lg">
                      {icon}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{label}</p>
                    <p className="text-sm font-bold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800">Select Date & Time</h4>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#E05C8A] focus:ring-2 focus:ring-rose-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Time Slot
                </label>
                {!selectedDate ? (
                  <p className="text-sm text-gray-400 mt-2">
                    Please select a date first
                  </p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-amber-600 mt-2">
                    {(() => {
                      const [y, m, d] = selectedDate.split("-").map(Number);
                      const dt = new Date(y, m - 1, d);
                      const days = [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ];
                      return (
                        doctor.availability?.find(
                          (a) => a.day === days[dt.getDay()],
                        )?.slots?.length > 0
                      );
                    })()
                      ? "All slots are already booked for this day"
                      : "No available slots for this day"}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {availableSlots.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${selectedTime === t ? "bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white border-transparent shadow-lg" : "border-gray-200 text-gray-600 hover:border-rose-300 hover:text-[#E05C8A]"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
                <span className="font-bold">
                  Fee: {doctor.consultation_fee || doctor.fee} ETB
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("chapa")}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${paymentMethod === "chapa" ? "bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-rose-300"}`}
                  >
                    Chapa (Online)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("receipt_upload")}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${paymentMethod === "receipt_upload" ? "bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-rose-300"}`}
                  >
                    Upload Receipt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3 flex-shrink-0">
          {!showBooking && !showPayment ? (
            <>
              <button
                onClick={() => setShowBooking(true)}
                disabled={doctor.status === "suspended"}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {doctor.status === "suspended"
                  ? "Currently Unavailable"
                  : "Book Appointment"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all"
              >
                Close
              </button>
            </>
          ) : showBooking ? (
            <>
              <button
                onClick={handleBook}
                disabled={
                  !selectedDate || !selectedTime || !paymentMethod || loading
                }
                className="flex-1 py-2.5 bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? "Processing..." : "Continue to Payment"}
              </button>
              <button
                onClick={() => setShowBooking(false)}
                disabled={loading}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Back
              </button>
            </>
          ) : (
            <>
              {paymentMethod === "receipt_upload" ? (
                <>
                  <button
                    onClick={handleReceiptUpload}
                    disabled={!receiptFile || loading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? "Uploading..." : "Submit Receipt"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleVerifyChapaPayment}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? "Verifying..." : "Verify Payment"}
                  </button>
                </>
              )}
              <button
                onClick={() => setShowPayment(false)}
                disabled={loading}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientDoctors() {
  const location = useLocation();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState(
    location.state?.specialtyFilter || "All",
  );
  const [feeRange, setFeeRange] = useState("All");
  const [minExp, setMinExp] = useState("All");
  const [selected, setSelected] = useState(null);

  const feeRanges = [
    { label: "All Fees", value: "All" },
    { label: "Under 300 ETB", value: "0-300" },
    { label: "300–600 ETB", value: "300-600" },
    { label: "600+ ETB", value: "600+" },
  ];

  const expOptions = [
    { label: "Any Experience", value: "All" },
    { label: "2+ Years", value: "2" },
    { label: "5+ Years", value: "5" },
    { label: "10+ Years", value: "10" },
  ];

  const fetchDoctors = async () => {
    setLoading(true);
    const filters = {};
    if (specialty !== "All") filters.specialty = specialty;
    if (search) filters.search = search;
    const result = await getDoctors(filters);
    if (result.data) setDoctors(result.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialty, search]);

  const handleBookingSuccess = () => fetchDoctors();

  const filtered = doctors.filter((d) => {
    const name = d.user?.full_name || d.name || "";
    const doctorSpecialty = d.specialty || "";
    const fee = d.consultation_fee || d.fee || 0;
    const exp = d.years_experience || 0;

    const matchSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      doctorSpecialty.toLowerCase().includes(search.toLowerCase()) ||
      (d.hospital || "").toLowerCase().includes(search.toLowerCase());

    const matchSpecialty = specialty === "All" || doctorSpecialty === specialty;

    const matchFee =
      feeRange === "All" ||
      (feeRange === "0-300" && fee < 300) ||
      (feeRange === "300-600" && fee >= 300 && fee <= 600) ||
      (feeRange === "600+" && fee > 600);

    const matchExp = minExp === "All" || exp >= parseInt(minExp);

    return matchSearch && matchSpecialty && matchFee && matchExp;
  });

  return (
    <PatientLayout title="Find Doctors">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-black text-[#E05C8A] flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">
              medical_services
            </span>
            Find Doctors
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {filtered.length} doctors available
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, specialty, or hospital..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#E05C8A] focus:ring-2 focus:ring-rose-100 bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#E05C8A] bg-white text-gray-700 font-semibold"
            >
              {specialties.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={feeRange}
              onChange={(e) => setFeeRange(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#E05C8A] bg-white text-gray-700 font-semibold"
            >
              {feeRanges.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={minExp}
              onChange={(e) => setMinExp(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#E05C8A] bg-white text-gray-700 font-semibold"
            >
              {expOptions.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            {(search ||
              specialty !== "All" ||
              feeRange !== "All" ||
              minExp !== "All") && (
              <button
                onClick={() => {
                  setSearch("");
                  setSpecialty("All");
                  setFeeRange("All");
                  setMinExp("All");
                }}
                className="px-4 py-2.5 border border-rose-200 text-[#E05C8A] rounded-xl text-sm font-semibold hover:bg-rose-50 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Doctor cards */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#E05C8A]"></div>
            <p className="text-gray-400 text-sm mt-3">Loading doctors...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <div
                key={doc._id || doc.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-rose-200 transition-all duration-300 p-5 group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#fff5f7] to-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm flex-shrink-0">
                    <span className="material-symbols-outlined text-[#E05C8A] text-2xl">
                      person
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-gray-800">
                          {doc.user?.full_name || doc.name}
                        </p>
                        <p className="text-xs text-gray-500">{doc.specialty}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-100 text-emerald-700">
                        Verified
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`material-symbols-outlined text-xs ${i < Math.floor(doc.rating) ? "text-yellow-400" : "text-gray-200"}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                      ))}
                      <span className="text-xs text-gray-400 ml-1">
                        {doc.rating} (
                        {doc.years_experience
                          ? `${doc.years_experience} yrs exp`
                          : "Experienced"}
                        )
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="material-symbols-outlined text-sm text-[#E05C8A]">
                      work_history
                    </span>
                    {doc.years_experience
                      ? `${doc.years_experience} Years`
                      : "Experienced"}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="material-symbols-outlined text-sm text-[#E05C8A]">
                      payments
                    </span>
                    {doc.consultation_fee || doc.fee} ETB
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500 col-span-2 truncate">
                    <span className="material-symbols-outlined text-sm text-[#E05C8A]">
                      local_hospital
                    </span>
                    <span className="truncate">
                      {doc.hospital || "Available"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelected(doc)}
                  className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#E05C8A] to-[#F4845F] text-white text-xs font-bold rounded-xl hover:scale-[1.02] transition-all shadow-md shadow-rose-200"
                >
                  View Profile & Book
                </button>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <span className="material-symbols-outlined text-5xl text-gray-200">
              medical_services
            </span>
            <p className="text-gray-400 mt-3">
              No doctors found matching your search
            </p>
          </div>
        )}
      </div>

      {selected && (
        <DoctorModal
          doctor={selected}
          onClose={() => setSelected(null)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}
    </PatientLayout>
  );
}
