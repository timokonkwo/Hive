import { Loader2 } from "lucide-react";

export function BnbButtonLoader({ size = 15 }: { size?: number }) {
  return <Loader2 aria-hidden="true" className="bnb-button-loader" size={size} />;
}
