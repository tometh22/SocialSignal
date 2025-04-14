import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  List,
  Users,
  History,
  Settings,
  Menu,
  X,
  Home
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/new-quote", label: "New Quote", icon: PlusCircle },
    { href: "/manage-quotes", label: "Manage Quotes", icon: List },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/history", label: "History", icon: History },
    { href: "/admin", label: "Admin Panel", icon: Settings },
  ];

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu when a link is clicked
  const handleNavigation = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-20 m-4">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMobileMenu}
          className="rounded-full"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar for mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-10 w-64 bg-white transform transition-transform duration-300 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 px-4 border-b border-neutral-200">
            <h1 className="text-xl font-semibold text-neutral-900">Quotation System</h1>
          </div>

          <div className="flex flex-col flex-grow overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                        location === item.href
                          ? "bg-primary text-white"
                          : "text-neutral-700 hover:bg-neutral-100"
                      )}
                      onClick={handleNavigation}
                    >
                      <Icon
                        className={cn(
                          "mr-3 h-5 w-5",
                          location === item.href
                            ? "text-white text-opacity-80"
                            : "text-neutral-400"
                        )}
                      />
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex-shrink-0 p-4 border-t border-neutral-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                  JS
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-neutral-700">Jane Smith</p>
                <p className="text-xs text-neutral-500">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-neutral-200 bg-white">
          <div className="flex items-center justify-center h-16 px-4 border-b border-neutral-200">
            <h1 className="text-xl font-semibold text-neutral-900">Quotation System</h1>
          </div>

          <div className="flex flex-col flex-grow overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                        location === item.href
                          ? "bg-primary text-white"
                          : "text-neutral-700 hover:bg-neutral-100"
                      )}
                    >
                      <Icon
                        className={cn(
                          "mr-3 h-5 w-5",
                          location === item.href
                            ? "text-white text-opacity-80"
                            : "text-neutral-400"
                        )}
                      />
                      {item.label}
                    </a>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex-shrink-0 p-4 border-t border-neutral-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                  JS
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-neutral-700">Jane Smith</p>
                <p className="text-xs text-neutral-500">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
