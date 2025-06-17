import { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div style={{ padding: 32 }}>
      <h1>Admin Panel</h1>
      {children}
    </div>
  );
}
