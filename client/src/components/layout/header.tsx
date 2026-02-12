import { Shield, Settings, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { user } = useAuth();

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User"
    : "";

  return (
    <header className="bg-charcoal-800/80 backdrop-blur-sm border-b border-charcoal-700 sticky top-0 z-50">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-matte-cyan-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-100">SecureScanner</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1 text-gray-400 hover:text-gray-200">
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={displayName}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-matte-cyan-600/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-matte-cyan" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-charcoal-800 border-charcoal-700 text-gray-200 w-48">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-100 truncate">{displayName}</p>
                  {user?.email && (
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  )}
                </div>
                <DropdownMenuSeparator className="bg-charcoal-700" />
                <Link href="/settings">
                  <DropdownMenuItem className="cursor-pointer hover:bg-charcoal-700 focus:bg-charcoal-700">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-charcoal-700" />
                <DropdownMenuItem
                  className="cursor-pointer text-red-400 hover:bg-charcoal-700 focus:bg-charcoal-700 focus:text-red-400"
                  onClick={() => { window.location.href = "/api/logout"; }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
