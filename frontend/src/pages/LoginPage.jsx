import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { colors, fonts } from "../styles/theme";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "Email hoặc mật khẩu không đúng"
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fonts.body,
      }}
    >
      <div
        style={{
          width: 400,
          background: colors.bgCard,
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          padding: 40,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 16,
            }}
          >
            ⌂
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>
            GFA Optimizer
          </h1>
          <p style={{ fontSize: 12, color: colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
            Đăng nhập để tiếp tục
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              required
              style={{
                width: "100%",
                background: colors.bgInput,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                padding: "12px 14px",
                fontSize: 14,
                marginTop: 6,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                background: colors.bgInput,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                padding: "12px 14px",
                fontSize: 14,
                marginTop: 6,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: `${colors.red}15`,
                border: `1px solid ${colors.red}33`,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: colors.red,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 8,
              border: "none",
              background: loading
                ? colors.borderLight
                : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 11, color: colors.textDim, marginTop: 24 }}>
          Chỉ tài khoản được cấp phép mới có thể đăng nhập.
          <br />
          Liên hệ quản trị viên nếu bạn cần truy cập.
        </p>
      </div>
    </div>
  );
}
