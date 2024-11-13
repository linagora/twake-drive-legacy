import _ from "lodash";
import {
  InputHTMLAttributes,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";

let interval: ReturnType<typeof setInterval> | null = null;

export const AnimatedHeight = memo(
  (props: { children: ReactNode } & InputHTMLAttributes<HTMLDivElement>) => {
    const el = useRef<HTMLDivElement>(null);

    const updateSize = useCallback(() => {
      if (el.current) {
        const contentHeight = el.current.scrollHeight;
        const parent = el.current.parentNode as HTMLDivElement;
        parent.style.height = `${contentHeight}px`;
        parent.style.overflow = `hidden`;
      }
    }, [el]);

    useEffect(() => {
      interval = setInterval(() => {
        updateSize();
      }, 200);
      return () => {
        if (interval)
          clearInterval(interval);
      };
    }, []);

    return (
      <div className="transition-all px-1 -mx-1">
        <div
          {..._.omit(props, "children")}
          ref={el}
          style={{
            boxSizing: "border-box",
          }}
        >
          {props.children}
        </div>
      </div>
    );
  }
);
