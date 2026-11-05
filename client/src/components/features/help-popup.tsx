import { Link } from "wouter";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HelpPopup() {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-muted-foreground"
      title="Ayuda y capacitación"
    >
      <Link href="/training" aria-label="Ayuda y capacitación">
        <HelpCircle className="h-5 w-5" aria-hidden="true" />
      </Link>
    </Button>
  );
}
