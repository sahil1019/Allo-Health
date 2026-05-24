"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Reservation {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const compute = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (remaining / 600) * 100; // 600s = 10min
  const isLow = remaining < 60;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: "48px",
        fontFamily: "Courier New, monospace",
        fontWeight: 700,
        color: isLow ? "var(--error)" : "var(--accent)",
        letterSpacing: "2px",
        lineHeight: 1,
      }}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div style={{ marginTop: "12px" }}>
        <div style={{
          height: "6px",
          backgroundColor: "#e5e7eb",
          borderRadius: "3px",
          overflow: "hidden",
          width: "220px",
          margin: "0 auto",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: isLow ? "var(--error)" : "var(--accent)",
            transition: "width 1s linear, background-color 0.3s",
          }} />
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
          {remaining === 0 ? "Reservation expired" : "remaining to complete purchase"}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    PENDING: { bg: "#fffbeb", color: "#d97706", label: "PENDING" },
    CONFIRMED: { bg: "#f0fdf4", color: "#16a34a", label: "CONFIRMED" },
    RELEASED: { bg: "#f9fafb", color: "#6b7280", label: "RELEASED" },
  }[status] ?? { bg: "#f9fafb", color: "#6b7280", label: status };

  return (
    <span style={{
      fontSize: "11px",
      fontFamily: "monospace",
      fontWeight: 700,
      letterSpacing: "0.5px",
      color: config.color,
      backgroundColor: config.bg,
      padding: "3px 10px",
      borderRadius: "4px",
    }}>
      {config.label}
    </span>
  );
}

export default function ReservationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      // We don't have a GET /api/reservations/:id endpoint,
      // but we can use the POST confirm endpoint as a no-op read alternative.
      // Instead, let's just store the reservation data in state from when we navigate here.
      // Since we navigated here, we refetch via a lightweight GET we'll add.
      const res = await fetch(`/api/reservations/${id}`);
      if (res.status === 404) {
        setError("Reservation not found");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setReservation(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
    // Poll every 5s to reflect expiry / state changes from other tabs
    pollRef.current = setInterval(fetchReservation, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchReservation]);

  const handleConfirm = async () => {
    setActionError(null);
    setActionLoading("confirm");
    try {
      const idempotencyKey = `confirm-${id}-${Date.now()}`;
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const data = await res.json();
      if (res.status === 410) {
        setActionError("Your reservation expired before payment could be confirmed. The stock has been released.");
        await fetchReservation();
        return;
      }
      if (!res.ok) {
        setActionError(data.error || "Confirmation failed");
        return;
      }
      setReservation(data);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    setActionLoading("cancel");
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Cancellation failed");
        return;
      }
      setReservation(data);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
        Loading reservation…
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div style={{
          padding: "20px",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          color: "var(--error)",
          marginBottom: "16px",
        }}>
          {error || "Reservation not found"}
        </div>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "10px 20px",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        >
          ← Back to products
        </button>
      </div>
    );
  }

  const isExpired = reservation.status === "PENDING" && new Date() > new Date(reservation.expiresAt);
  const isPending = reservation.status === "PENDING" && !isExpired;

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "14px",
            padding: 0,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          ← Back to products
        </button>
      </div>

      <div style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--card-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "monospace", marginBottom: "4px" }}>
              RESERVATION
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--foreground)" }}>
              #{id.slice(-8).toUpperCase()}
            </div>
          </div>
          <StatusBadge status={reservation.status} />
        </div>

        {/* Product details */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--card-border)" }}>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "2px" }}>Product</div>
            <div style={{ fontSize: "17px", fontWeight: 700 }}>{reservation.productName}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>Warehouse</div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{reservation.warehouseName}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>Quantity</div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{reservation.quantity}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>Reserved at</div>
              <div style={{ fontSize: "13px" }}>{new Date(reservation.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>Expires at</div>
              <div style={{ fontSize: "13px" }}>{new Date(reservation.expiresAt).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Countdown / status section */}
        <div style={{ padding: "28px 24px", borderBottom: "1px solid var(--card-border)", textAlign: "center" }}>
          {isPending && <Countdown expiresAt={reservation.expiresAt} />}

          {reservation.status === "CONFIRMED" && (
            <div style={{ color: "var(--success)" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>✓</div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Order confirmed</div>
              <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                Confirmed at {reservation.confirmedAt ? new Date(reservation.confirmedAt).toLocaleString() : "—"}
              </div>
            </div>
          )}

          {(reservation.status === "RELEASED" || isExpired) && (
            <div style={{ color: "var(--muted)" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>↩</div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Stock released</div>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                {isExpired ? "Your reservation expired" : "Reservation was cancelled"}
              </div>
            </div>
          )}
        </div>

        {/* Action error */}
        {actionError && (
          <div style={{
            margin: "0 24px",
            marginTop: "16px",
            padding: "10px 14px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--error)",
          }}>
            {actionError}
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div style={{ padding: "20px 24px", display: "flex", gap: "12px" }}>
            <button
              onClick={handleConfirm}
              disabled={actionLoading !== null}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.7 : 1,
                fontFamily: "inherit",
                transition: "background-color 0.15s",
              }}
            >
              {actionLoading === "confirm" ? "Confirming…" : "Confirm purchase"}
            </button>
            <button
              onClick={handleCancel}
              disabled={actionLoading !== null}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "white",
                color: "var(--foreground)",
                border: "1px solid var(--card-border)",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
                opacity: actionLoading ? 0.7 : 1,
                fontFamily: "inherit",
              }}
            >
              {actionLoading === "cancel" ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        )}

        {reservation.status !== "PENDING" && (
          <div style={{ padding: "20px 24px" }}>
            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: reservation.status === "CONFIRMED" ? "var(--accent)" : "white",
                color: reservation.status === "CONFIRMED" ? "white" : "var(--foreground)",
                border: reservation.status === "CONFIRMED" ? "none" : "1px solid var(--card-border)",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ← Back to products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
