import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Conditional class names, with later Tailwind utilities winning over earlier conflicting ones. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
