"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type AdminLoginFormProps = {
  initialReason?: string;
};

const isPhoneValid = (phone: string) => /^1\d{10}$/.test(phone);
const isCodeValid = (code: string) => /^\d{6}$/.test(code);

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data as T;
}

export function AdminLoginForm({ initialReason }: AdminLoginFormProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    initialReason === "forbidden" ? "当前手机号没有后台权限，请使用管理员手机号登录。" : null
  );
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const canSendCode = isPhoneValid(phone) && !isSendingCode;
  const canLogin = isPhoneValid(phone) && isCodeValid(code) && !isLoggingIn;

  async function sendCode() {
    if (!isPhoneValid(phone)) {
      setError("请输入 11 位中国大陆手机号");
      return;
    }

    setIsSendingCode(true);
    setMessage(null);
    setError(null);

    try {
      const result = await readJson<{ ok: boolean; message?: string }>(
        await fetch("/api/admin/send-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({ phone })
        })
      );
      if (result.message) {
        setMessage(result.message);
        const devCode = result.message.match(/\b(\d{6})\b/)?.[1];
        if (devCode) {
          setCode(devCode);
        }
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "验证码发送失败");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isPhoneValid(phone)) {
      setError("请输入 11 位中国大陆手机号");
      return;
    }

    if (!isCodeValid(code)) {
      setError("请输入 6 位数字验证码");
      return;
    }

    setIsLoggingIn(true);
    setMessage(null);
    setError(null);

    try {
      await readJson(
        await fetch("/api/admin/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: JSON.stringify({ phone, code })
        })
      );
      window.location.assign("/admin");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "后台登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-brand">
          <img src="/logo-mark.svg" alt="" aria-hidden="true" />
        </div>
        <div className="admin-login-copy">
          <h1 id="admin-login-title">运营后台</h1>
        </div>

        <form className="modal-login-form" onSubmit={login}>
          <label>
            管理员手机号
            <input
              inputMode="numeric"
              maxLength={11}
              placeholder="请输入管理员手机号"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label>
            验证码
            <div className="code-input-row">
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="请输入验证码"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
              <button type="button" onClick={() => void sendCode()} disabled={!canSendCode}>
                {isSendingCode ? "发送中" : "获取验证码"}
              </button>
            </div>
          </label>

          {message ? <div className="admin-login-message success">{message}</div> : null}
          {error ? <div className="admin-login-message error">{error}</div> : null}

          <button className="btn primary" type="submit" disabled={!canLogin}>
            {isLoggingIn ? "登录中" : "进入后台"}
          </button>
        </form>

        <Link className="admin-login-return" href="/" target="_blank" rel="noreferrer">
          返回发单工作台
        </Link>
      </section>
    </main>
  );
}
