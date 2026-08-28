import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AppLogo } from "@/components/layout/app-logo";

export default function LoginPage() {
	return (
		<div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
			<div className="w-full max-w-md">
				<div className="mb-8 flex flex-col items-center text-center">
					<AppLogo size="lg" priority />
					<h1 className="font-heading text-3xl font-semibold tracking-tight">
						Welcome back
					</h1>
					<p className="text-sm text-muted-foreground">
						Sign in to the Telepastors Ministry workspace
					</p>
				</div>
				<Suspense
					fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
					<LoginForm />
				</Suspense>
			</div>
		</div>
	);
}
