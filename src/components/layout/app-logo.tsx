import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/first-love-logo.png";
const LOGO_WIDTH = 577;
const LOGO_HEIGHT = 433;

type AppLogoProps = {
	className?: string;
	size?: "sm" | "md" | "lg";
	linked?: boolean;
	priority?: boolean;
};

const sizeClasses = {
	sm: "h-12 w-auto",
	md: "h-16 w-auto",
	lg: "h-24 w-auto sm:h-32",
} as const;

export function AppLogo({
	className,
	size = "md",
	linked = false,
	priority = false,
}: AppLogoProps) {
	const image = (
		<Image
			src={LOGO_SRC}
			alt="First Love Church"
			width={LOGO_WIDTH}
			height={LOGO_HEIGHT}
			priority={priority}
			className={cn(sizeClasses[size], "object-contain", className)}
		/>
	);

	if (linked) {
		return (
			<Link
				href="/dashboard"
				className="inline-flex shrink-0 items-center"
				aria-label="First Love Church home">
				{image}
			</Link>
		);
	}

	return image;
}
