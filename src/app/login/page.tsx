import { LoginForm } from "./login-form";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const metadata = { title: `${APP_NAME} · Login` };

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[340px] flex flex-col items-center">
        <div className="w-11 h-11 rounded-xl bg-primary text-primary-contrast flex items-center justify-center font-semibold text-xl">
          {APP_NAME.charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-text-primary">{APP_NAME}</h1>
        <p className="mt-1.5 text-[13.5px] text-text-secondary">{APP_TAGLINE}</p>
        <LoginForm />
      </div>
    </main>
  );
}
