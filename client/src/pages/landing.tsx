import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ScanSearch, FolderLock, BarChart3, LogIn } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-charcoal-900 via-charcoal-800 to-charcoal-900 flex flex-col">
      <header className="bg-charcoal-800/80 backdrop-blur-sm border-b border-charcoal-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-matte-cyan-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-100">SecureScanner</h1>
          </div>
          <a href="/api/login">
            <Button size="sm" className="bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-matte-cyan-600/20 rounded-2xl flex items-center justify-center mx-auto border border-matte-cyan/30">
            <Shield className="w-8 h-8 text-matte-cyan" />
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-gray-100 font-serif leading-tight">
            Keep Your Files Clean & Safe
          </h2>
          <p className="text-gray-400 text-lg max-w-lg mx-auto">
            AI-powered content detection that automatically scans, identifies, and organizes inappropriate files — so you don't have to.
          </p>

          <a href="/api/login">
            <Button size="lg" className="bg-matte-cyan-600 hover:bg-matte-cyan-700 text-white font-semibold px-8 py-6 text-lg rounded-xl mt-4 transition-all duration-200 active:scale-95">
              Get Started
            </Button>
          </a>
          <p className="text-gray-500 text-sm">Free to use. No credit card required.</p>
        </div>

        <div className="max-w-4xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 px-4 w-full">
          <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700 hover:border-matte-cyan/30 transition-colors">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-12 h-12 bg-matte-cyan-600/20 rounded-xl flex items-center justify-center mx-auto">
                <ScanSearch className="w-6 h-6 text-matte-cyan" />
              </div>
              <h3 className="font-semibold text-gray-100">Smart Detection</h3>
              <p className="text-gray-400 text-sm">InceptionV3 AI model with ~93% accuracy analyzes images and videos for inappropriate content.</p>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700 hover:border-matte-cyan/30 transition-colors">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-12 h-12 bg-matte-cyan-600/20 rounded-xl flex items-center justify-center mx-auto">
                <FolderLock className="w-6 h-6 text-matte-cyan" />
              </div>
              <h3 className="font-semibold text-gray-100">Auto-Organize</h3>
              <p className="text-gray-400 text-sm">Automatically sort flagged files by category, date, or type into customizable folder structures.</p>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-800/60 backdrop-blur-sm border border-charcoal-700 hover:border-matte-cyan/30 transition-colors">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="w-12 h-12 bg-matte-cyan-600/20 rounded-xl flex items-center justify-center mx-auto">
                <BarChart3 className="w-6 h-6 text-matte-cyan" />
              </div>
              <h3 className="font-semibold text-gray-100">Detailed Reports</h3>
              <p className="text-gray-400 text-sm">View comprehensive scan reports with filtering, statistics, and exportable results.</p>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-charcoal-700 py-4 text-center text-gray-500 text-xs">
        &copy; {new Date().getFullYear()} SecureScanner by Kaos Forge. All rights reserved.
      </footer>
    </div>
  );
}
