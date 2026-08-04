"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MapPinned, Plus, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items: Array<{
  href: string;
  label: string;
  icon: typeof Compass;
  emphasize?: boolean;
}> = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/saved", label: "My Places", icon: MapPinned },
  { href: "/add", label: "Add", icon: Plus, emphasize: true },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur xl:hidden safe-pb"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 px-1 pt-1">
        {items.map(({ href, label, icon: Icon, emphasize }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                  active ? "text-teal-deep" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    emphasize &&
                      "bg-teal text-primary-foreground shadow-sm -mt-3 h-12 w-12 border-4 border-paper",
                    emphasize && active && "bg-teal-deep",
                    !emphasize && active && "bg-teal/10",
                  )}
                >
                  <Icon className={cn(emphasize ? "h-5 w-5" : "h-4 w-4")} />
                </span>
                <span className={cn(emphasize && "font-medium text-teal-deep")}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
