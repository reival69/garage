import { useRef } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Optional dot color (defaults to brand accent). */
  showMark?: boolean;
  /** Optional tenant logo (base64). When set, it replaces the wordmark. */
  logoUrl?: string | null;
}

const LONG_PRESS_MS = 1000;

/** Talleo wordmark — Plus Jakarta Sans 700, monochrome. */
export function Logo({ className, showMark = true, logoUrl }: LogoProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    clear();
    timer.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("talleo:open-panel"));
      }
    }, LONG_PRESS_MS);
  };

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo del taller"
        onPointerDown={start}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        className={cn("h-7 w-auto max-w-[140px] object-contain select-none", className)}
      />
    );
  }

  return (
    <span
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      className={cn(
        "inline-flex items-center gap-1.5 text-foreground select-none",
        className,
      )}
    >
      <svg
        viewBox="0 0 2920 889"
        role="img"
        aria-label="Talleo"
        className="h-5 w-auto"
        fill="currentColor"
      >
        <g transform="translate(60,817) scale(1,-1)">
          <path d="M204.0 0V625H11.0V745H531.0V625H341.0V0Z M753.0 -12Q696.0 -12 654.0 7.0Q612.0 26 589.0 61.5Q566.0 97 566.0 144Q566.0 189 586.0 224.5Q606.0 260 648.0 284.0Q690.0 308 754.0 318L932.0 347V247L779.0 221Q740.0 214 721.0 196.0Q702.0 178 702.0 149Q702.0 121 723.5 104.5Q745.0 88 777.0 88Q818.0 88 849.5 105.5Q881.0 123 898.5 154.0Q916.0 185 916.0 222V362Q916.0 397 888.5 420.5Q861.0 444 816.0 444Q774.0 444 741.5 421.5Q709.0 399 694.0 362L587.0 414Q603.0 457 637.5 488.5Q672.0 520 719.0 538.0Q766.0 556 821.0 556Q888.0 556 939.0 531.5Q990.0 507 1018.5 463.5Q1047.0 420 1047.0 362V0H923.0V93L951.0 95Q930.0 60 901.0 36.5Q872.0 13 835.0 0.5Q798.0 -12 753.0 -12Z M1153.0 0V757H1284.0V0Z M1390.0 0V757H1521.0V0Z M1885.0 -12Q1801.0 -12 1738.0 26.0Q1675.0 64 1640.0 129.0Q1605.0 194 1605.0 273Q1605.0 355 1640.5 418.5Q1676.0 482 1737.5 519.0Q1799.0 556 1875.0 556Q1939.0 556 1987.5 535.0Q2036.0 514 2070.0 477.0Q2104.0 440 2122.0 392.5Q2140.0 345 2140.0 290Q2140.0 276 2138.5 261.0Q2137.0 246 2133.0 235H1713.0V335H2059.0L1997.0 288Q2006.0 334 1992.5 370.0Q1979.0 406 1948.5 427.0Q1918.0 448 1875.0 448Q1834.0 448 1802.0 427.5Q1770.0 407 1753.5 367.5Q1737.0 328 1741.0 272Q1737.0 222 1754.5 183.5Q1772.0 145 1806.5 124.0Q1841.0 103 1886.0 103Q1931.0 103 1962.5 122.0Q1994.0 141 2012.0 173L2118.0 121Q2102.0 82 2068.0 52.0Q2034.0 22 1987.5 5.0Q1941.0 -12 1885.0 -12Z M2490.0 -12Q2410.0 -12 2344.5 25.0Q2279.0 62 2240.5 126.0Q2202.0 190 2202.0 272Q2202.0 354 2240.5 418.0Q2279.0 482 2344.0 519.0Q2409.0 556 2490.0 556Q2570.0 556 2635.0 519.0Q2700.0 482 2738.5 418.5Q2777.0 355 2777.0 272Q2777.0 190 2738.0 126.0Q2699.0 62 2634.0 25.0Q2569.0 -12 2490.0 -12ZM2490.0 108Q2534.0 108 2567.5 129.0Q2601.0 150 2620.5 187.5Q2640.0 225 2640.0 272Q2640.0 320 2620.5 356.5Q2601.0 393 2567.5 414.5Q2534.0 436 2490.0 436Q2445.0 436 2411.0 414.5Q2377.0 393 2357.5 356.5Q2338.0 320 2338.0 272Q2338.0 225 2357.5 187.5Q2377.0 150 2411.0 129.0Q2445.0 108 2490.0 108Z" />
        </g>
      </svg>
    </span>
  );
}
