import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err) {
      setError("Giriş başarısız! Lütfen e-posta ve şifrenizi kontrol edin.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-emerald-700">Giriş Yap</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
        <div className="mb-4">
          <label className="block mb-1 text-gray-700">E-posta</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded p-2" required autoFocus />
        </div>
        <div className="mb-6">
          <label className="block mb-1 text-gray-700">Şifre</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded p-2" required />
        </div>
        <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition" disabled={loading}>
          {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
};

export default Login; 