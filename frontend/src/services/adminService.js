/**
 * ADMIN SERVICE
 *
 * All admin-related API calls are here.
 * Currently returns mock data.
 *
 * TO INTEGRATE BACKEND:
 * 1. Import supabase from "./supabase"
 * 2. Replace each mock return with the real Supabase query shown in the comment above it
 * 3. Do NOT change the function names or return shapes — pages depend on them
 */

import {
  mockBlogs,
  mockNotifications,
  mockActivity,
} from "../pages/Admin/data/mockData";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const readResponseError = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      return payload.message || "Request failed";
    } catch {
      return "Request failed";
    }
  }
  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await readResponseError(response));
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

export const getRecentActivity = async () => {
  return { data: mockActivity, error: null };
};

// ─── USERS ────────────────────────────────────────────────────────────────────

export const getPatients = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await readResponseError(response));
    const data = await response.json();
    return { data: data.filter((u) => u.role === "patient"), error: null };
  } catch (err) {
    
    return { data: null, error: err.message };
  }
};

export const blockUser = async (userId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/users/${userId}/block`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      },
    );
    if (!response.ok) throw new Error(await readResponseError(response));
    return { error: null };
  } catch (err) {
    //return { error: err.message };
    return {
  data: data
    .filter((u) => u.role === "patient")
    .map((u) => ({
      id: u._id,
      name: u.full_name,
      email: u.email,
      age: u.age ?? "—",
      gender: u.gender ?? "—",
      status: u.is_blocked ? "blocked" : "active",
      lastActive: u.updatedAt
        ? new Date(u.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "N/A",
    })),
  error: null,
};
  }
};

export const unblockUser = async (userId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/users/${userId}/unblock`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      },
    );
    if (!response.ok) throw new Error(await readResponseError(response));
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

// ─── DOCTORS ──────────────────────────────────────────────────────────────────

/**
 * BACKEND:
 * const { data } = await supabase.from("doctors")
 *   .select("*, profiles(*), doctor_applications(*)")
 *   .order("created_at", { ascending: false })
 */
export const getDoctors = async () => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/admin/doctors`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

/**
 * BACKEND:
 * const { data } = await supabase.from("doctor_applications")
 *   .select("*")
 *   .eq("status", "pending_review")
 *   .order("created_at", { ascending: false })
 */
export const getPendingDoctorApplications = async () => {
  try {
    const { data, error } = await getDoctors();
    if (error) throw new Error(error);
    return {
      data: data.filter((doctor) => doctor.status === "pending"),
      error: null,
    };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

/**
 * BACKEND:
 * // 1. Update application status
 * await supabase.from("doctor_applications").update({ status: "approved", reviewed_by: adminId }).eq("id", applicationId)
 * // 2. Create profiles entry for doctor
 * await supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true })
 * // 3. Create doctors table entry
 * await supabase.from("doctors").insert({ user_id: newUserId, specialty, is_verified: true, ... })
 * // 4. Send email with credentials (via Edge Function)
 */
export const approveDoctor = async (doctorId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/api/admin/doctors/${doctorId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "approved" }),
      },
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

/**
 * BACKEND:
 * await supabase.from("doctor_applications")
 *   .update({ status: "rejected", rejection_reason: reason, reviewed_by: adminId })
 *   .eq("id", applicationId)
 * // Then trigger Edge Function to send rejection email
 */
export const rejectDoctor = async (doctorId, reason) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/api/admin/doctors/${doctorId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      },
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

/**
 * BACKEND:
 * await supabase.from("doctors").update({ is_verified: false }).eq("id", doctorId)
 * // Also ban their auth account temporarily
 */
export const suspendDoctor = async (doctorId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/api/admin/doctors/${doctorId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "suspended" }),
      },
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

/**
 * BACKEND:
 * await supabase.from("doctors").update({ is_verified: true }).eq("id", doctorId)
 * // Unban their auth account
 */
export const reinstateDoctor = async (doctorId) => {
  return approveDoctor(doctorId);
};

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

/**
 * BACKEND:
 * const { data } = await supabase.from("appointments")
 *   .select("*, patient:profiles!patient_id(full_name), doctor:doctors(profiles(full_name), specialty)")
 *   .order("scheduled_at", { ascending: false })
 */
export const getAllAppointments = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/appointments`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await readResponseError(response));
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

export const cancelAppointment = async (appointmentId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/appointments/${appointmentId}/cancel`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      },
    );
    if (!response.ok) throw new Error(await readResponseError(response));
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

// ─── MEDICAL RECORDS ──────────────────────────────────────────────────────────

/**
 * BACKEND:
 * const { count } = await supabase.from("health_records").select("*", { count: "exact" })
 * const { count: alertCount } = await supabase.from("vital_alerts").select("*", { count: "exact" }).eq("acknowledged_at", null)
 */
export const getMedicalRecordsStats = async () => {
  return {
    data: {
      totalRecords: 45821,
      criticalAlerts: 2,
      recordsThisWeek: 892,
      pendingLabOrders: 67,
    },
    error: null,
  };
};

/**
 * BACKEND:
 * const { data } = await supabase.from("vital_alerts")
 *   .select("*, patient:profiles(full_name), doctor:doctors(profiles(full_name))")
 *   .is("acknowledged_at", null)
 *   .order("created_at", { ascending: false })
 */
export const getCriticalAlerts = async () => {
  return {
    data: [
      {
        id: 1,
        patient: "Bereket Tadesse",
        alert: "Critical SpO2: 88%",
        doctor: "Dr. Alem Bekele",
        time: "2 mins ago",
        acknowledged: false,
      },
      {
        id: 2,
        patient: "Sara Haile",
        alert: "Blood Sugar: 210 mg/dL",
        doctor: "Dr. Tigist Worku",
        time: "15 mins ago",
        acknowledged: false,
      },
      {
        id: 3,
        patient: "Yonas Bekele",
        alert: "Heart Rate: 155 BPM",
        doctor: "Dr. Michael Chen",
        time: "1 hour ago",
        acknowledged: true,
      },
    ],
    error: null,
  };
};

// ─── BLOGS ────────────────────────────────────────────────────────────────────

/**
 * BACKEND:
 * const { data } = await supabase.from("blogs")
 *   .select("*, author:profiles(full_name, avatar_url)")
 *   .order("created_at", { ascending: false })
 */
export const getAllBlogs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/blogs`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to fetch blogs");
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * BACKEND:
 * await supabase.from("blogs").update({ status: "published", published_at: new Date() }).eq("id", blogId)
 */
export const approveBlog = async (blogId) => {
  return { error: null };
};

/**
 * BACKEND:
 * await supabase.from("blogs")
 *   .update({ status: "rejected", rejection_reason: reason, reviewed_by: adminId })
 *   .eq("id", blogId)
 * // Trigger Edge Function to notify author
 */
export const rejectBlog = async (blogId, reason) => {
  return { error: null };
};

/**
 * BACKEND:
 * await supabase.from("blogs").delete().eq("id", blogId)
 */
export const deleteBlog = async (blogId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/blogs/${blogId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to delete blog");
    }
    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * BACKEND:
 * await supabase.from("blogs").insert({
 *   author_id: adminUserId,
 *   title, content, category,
 *   status: "published",
 *   published_at: new Date()
 * })
 */
export const toggleLikeBlog = async (blogId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/blogs/${blogId}/like`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to like blog");
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const updateBlog = async (blogId, blogData) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/blogs/${blogId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(blogData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to update blog");
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const createBlog = async (blogData) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/blogs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(blogData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to create blog");
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export const getAllPayments = async () => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/api/admin/payments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
};

export const approvePayment = async (paymentId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/api/admin/payments/${paymentId}/approve`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

export const rejectPayment = async (paymentId, reason) => {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/api/admin/payments/${paymentId}/reject`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      },
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

export const processRefund = async (paymentId) => {
  return { error: null };
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

/**
 * BACKEND:
 * const { data } = await supabase.from("notifications")
 *   .select("*")
 *   .order("created_at", { ascending: false })
 *   .limit(50)
 */
export const getNotifications = async () => {
  return { data: mockNotifications, error: null };
};

/**
 * BACKEND:
 * await supabase.from("notifications").update({ is_read: true }).eq("user_id", adminId)
 */
export const markAllNotificationsRead = async () => {
  return { error: null };
};

/**
 * BACKEND:
 * // Insert notification for each target user
 * // Or call Express endpoint: POST /api/notifications/broadcast
 * await fetch("/api/notifications/send", {
 *   method: "POST",
 *   body: JSON.stringify({ title, message, target: "all" | "patients" | "doctors" })
 * })
 */
export const sendBroadcast = async ({ title, message, target }) => {
  return { error: null };
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

/**
 * BACKEND:
 * const { data } = await supabase.from("settings").select("key, value")
 * // Convert array to object: { platformName: "RPHMS", ... }
 */
export const getSettings = async () => {
  return {
    data: {
      platformName: "Tenaye Health",
      tagline: "Remote Patient Health Monitoring System",
      supportEmail: "support@tenayehealth.com",
      language: "en",
      timezone: "Africa/Addis_Ababa",
      jwtExpiry: 24,
      rateLimit: 1000,
      refreshExpiry: "7d",
      rateLimiting: true,
      twoFactor: false,
      emailNotifs: true,
      inAppNotifs: true,
      criticalAlerts: true,
      appointmentReminders: true,
      reminderTime: "60",
      currency: "ETB",
      maxFileSize: 10,
    },
    error: null,
  };
};

/**
 * BACKEND:
 * // Convert settings object to array of { key, value } and upsert
 * const rows = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }))
 * await supabase.from("settings").upsert(rows, { onConflict: "key" })
 */
export const saveSettings = async (settings) => {
  return { error: null };
};

// ─── EXPORT FUNCTIONS (Backend Ready) ─────────────────────────────────────────

/**
 * BACKEND:
 * const { data } = await supabase.from("profiles")
 *   .select("id, full_name, email, role, gender, age, created_at")
 *   .eq("role", "patient")
 */
export const exportUsers = async () => {
  const { data } = await getPatients();
  return data;
};

/**
 * BACKEND:
 * const { data } = await supabase.from("doctors")
 *   .select("*, profiles(*), doctor_applications(*)")
 */
export const exportDoctors = async () => {
  const { data } = await getDoctors();
  return data;
};

/**
 * BACKEND:
 * const { data } = await supabase.from("appointments")
 *   .select("*, patient:profiles!patient_id(full_name), doctor:doctors(profiles(full_name))")
 */
export const exportAppointments = async () => {
  const { data } = await getAllAppointments();
  return data;
};

/**
 * BACKEND:
 * const { data } = await supabase.from("payments")
 *   .select("*, patient:profiles!patient_id(full_name), doctor:doctors(profiles(full_name))")
 */
export const exportPayments = async () => {
  const { data } = await getAllPayments();
  return data;
};

/**
 * BACKEND:
 * const { data } = await supabase.from("blogs")
 *   .select("*, author:profiles(full_name, avatar_url)")
 */
export const exportBlogs = async () => {
  const { data } = await getAllBlogs();
  return data;
};

/**
 * BACKEND:
 * const { count: totalPatients } = await supabase.from("profiles").select("*", { count: "exact" }).eq("role", "patient")
 * const { count: activeDoctors } = await supabase.from("doctors").select("*", { count: "exact" }).eq("is_verified", true)
 * const { count: appointmentsToday } = await supabase.from("appointments").select("*", { count: "exact" }).gte("scheduled_at", todayStart)
 * const { data: revenue } = await supabase.from("payments").select("amount").eq("status", "paid")
 * const { data: activity } = await supabase.from("appointments")
 *   .select("id, patient:profiles(full_name), doctor:doctors(profiles(full_name)), scheduled_at, status")
 *   .order("created_at", { ascending: false }).limit(10)
 */
export const exportDashboardReport = async () => {
  const [statsRes, activityRes] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
  ]);
  return { stats: statsRes.data, activity: activityRes.data };
};
