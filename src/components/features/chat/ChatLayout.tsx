"use client";

import { ReactNode } from "react";

interface ChatLayoutProps {
  children: ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return <div className="h-screen md:pt-0">{children}</div>;
}
