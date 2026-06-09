import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const specialties = [
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
];

export default function DoctorApply() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = personal, 2 = professional, 3 = success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    // Step 1 — personal
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    gender: "",
    // Step 2 — professional
    specialty: "",
    years_experience: "",
    license_number: "",
    hospital: "",
    consultation_fee: "",
    bio: "",
  });

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const validateStep1 = () => {
    if (!form.full_name || !form.email || !form.password || !form.phone)
      return "Name, email, phone and password are required.";
    if (form.password.length < 6)
      return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    return null;
  };

  const validateStep2 = () => {
    if (!form.specialty) return "Please select your specialty.";
    if (!form.years_experience) return "Years of experience is required.";
    if (!form.license_number) return "License number is required.";
    if (!form.hospital) return "Hospital / clinic name is required.";
    if (!form.consultation_fee) return "Consultation fee is required.";
    if (!form.bio || form.bio.length < 30)
      return "Bio must be at least 30 characters.";
    return null;
  };

  const handleNext = () => {
    setError("");
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await fetch(`${API_BASE_URL}/api/auth/register/doctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          gender: form.gender,
          age: form.age ? Number(form.age) : undefined,
          specialty: form.specialty,
          years_experience: form.years_experience
            ? Number(form.years_experience)
            : undefined,
          license_number: form.license_number,
          hospital: form.hospital,
          consultation_fee: form.consultation_fee
            ? Number(form.consultation_fee)
            : undefined,
          bio: form.bio,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Submission failed. Please try again.");
      setStep(3);
    } catch (err) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#632a7e]/20 focus:border-[#632a7e]";

  const label = (text) => (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
      {text}
    </label>
  );

  // ── Step indicator ──────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-2 mb-6">
      {["Personal Info", "Professional Info"].map((name, i) => {
        const num = i + 1;
        const active = step === num;
        const done = step > num;
        return (
          <div key={name} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all
              ${done ? "bg-emerald-500 text-white" : active ? "bg-[#632a7e] text-white" : "bg-gray-100 text-gray-400"}`}
            >
              {done ? (
                <span className="material-symbols-outlined text-sm">check</span>
              ) : (
                num
              )}
            </div>
            <span
              className={`text-xs font-semibold hidden sm:block ${active ? "text-[#632a7e]" : done ? "text-emerald-600" : "text-gray-400"}`}
            >
              {name}
            </span>
            {i < 1 && (
              <div
                className={`flex-1 h-px ${done ? "bg-emerald-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdf7f9] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/home" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-[#632a7e] rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">
                stethoscope
              </span>
            </div>
            <span className="text-[#632a7e] font-bold text-xl">
              Tenaye Health
            </span>
          </Link>
          {step < 3 && (
            <>
              <h1 className="text-2xl font-black text-gray-800 mt-6">
                Apply as a Doctor
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Fill in your details — admin will review and approve your
                account
              </p>
            </>
          )}
        </div>

        {/* ── Success screen ── */}
        {step === 3 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-amber-500 text-4xl">
                pending_actions
              </span>
            </div>
            <h2 className="text-2xl font-black text-gray-800">
              Application Submitted!
            </h2>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              Your application is under review. We'll send you an email at{" "}
              <span className="font-bold text-gray-700">{form.email}</span> once
              the admin approves your account — usually within 24 hours.
            </p>

            <div className="mt-6 bg-[#fdf0f9] rounded-2xl p-4 text-left space-y-2 border border-purple-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
                What happens next
              </p>
              {[
                "Admin reviews your license and credentials",
                "You receive an approval email with login instructions",
                "Log in and set your availability schedule",
                "Patients can start booking appointments with you",
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-gray-600"
                >
                  <span className="w-5 h-5 rounded-full bg-[#632a7e] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/login")}
              className="w-full mt-6 py-3 bg-[#632a7e] text-white rounded-xl font-bold text-sm hover:bg-purple-900 transition-colors"
            >
              Go to Login
            </button>
            <p className="text-xs text-gray-400 mt-3">
              Already approved?{" "}
              <Link
                to="/login"
                className="text-[#632a7e] font-semibold hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* ── Form ── */}
        {step < 3 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <StepBar />

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
                <span className="material-symbols-outlined text-base">
                  error
                </span>
                {error}
              </div>
            )}

            {/* ── STEP 1 — Personal info ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  {label("Full Name")}
                  <input
                    type="text"
                    placeholder="Dr. Amanuel Tesfaye"
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {label("Phone")}
                    <input
                      type="tel"
                      placeholder="+251 91 234 5678"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    {label("Gender")}
                    <select
                      value={form.gender}
                      onChange={(e) => set("gender", e.target.value)}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  {label("Email")}
                  <input
                    type="email"
                    placeholder="doctor@example.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  {label("Password")}
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPass ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  {label("Confirm Password")}
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={(e) => set("confirm", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full py-3 bg-[#632a7e] text-white rounded-xl font-bold text-sm hover:bg-purple-900 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  Continue
                  <span className="material-symbols-outlined text-sm">
                    arrow_forward
                  </span>
                </button>
              </div>
            )}

            {/* ── STEP 2 — Professional info ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {label("Specialty")}
                    <select
                      value={form.specialty}
                      onChange={(e) => set("specialty", e.target.value)}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="">Select specialty</option>
                      {specialties.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    {label("Years of Experience")}
                    <input
                      type="number"
                      min="0"
                      max="60"
                      placeholder="e.g. 8"
                      value={form.years_experience}
                      onChange={(e) => set("years_experience", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  {label("Medical License Number")}
                  <input
                    type="text"
                    placeholder="e.g. ETH-MED-2015-4821"
                    value={form.license_number}
                    onChange={(e) => set("license_number", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  {label("Hospital / Clinic")}
                  <input
                    type="text"
                    placeholder="e.g. Black Lion Hospital, Addis Ababa"
                    value={form.hospital}
                    onChange={(e) => set("hospital", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  {label("Consultation Fee (ETB)")}
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={form.consultation_fee}
                    onChange={(e) => set("consultation_fee", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  {label("Bio / About You")}
                  <textarea
                    rows={4}
                    placeholder="Briefly describe your experience, specialization, and approach to patient care..."
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                  <p
                    className={`text-xs mt-1 ${form.bio.length < 30 ? "text-gray-400" : "text-emerald-600"}`}
                  >
                    {form.bio.length} / 30 characters minimum
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setStep(1);
                    }}
                    className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-[#632a7e] text-white rounded-xl font-bold text-sm hover:bg-purple-900 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">
                          send
                        </span>
                        Submit Application
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-sm text-gray-400 mt-6">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-[#632a7e] font-semibold hover:underline"
              >
                Sign in
              </Link>
            </p>
            <p className="text-center text-sm text-gray-400 mt-2">
              Registering as a patient?{" "}
              <Link
                to="/register"
                className="text-[#632a7e] font-semibold hover:underline"
              >
                Patient registration
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
