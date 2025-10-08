import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LucideIcon } from "lucide-react";

import { cn } from '@/lib/utils';
import { buttonVariants } from "./button";

export interface ToggleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "confirm" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isToggled?: boolean;
  onToggledChange?: (toggled: boolean) => void;
  iconOff?: LucideIcon;
  iconOn?: LucideIcon;
  iconSize?: number;
  showText?: boolean;
  textOff?: string;
  textOn?: string;
}

const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    isToggled = false,
    onToggledChange,
    iconOff,
    iconOn,
    iconSize = 16,
    showText = false,
    textOff,
    textOn,
    onClick,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onToggledChange) {
        onToggledChange(!isToggled);
      }
      if (onClick) {
        onClick(event);
      }
    };

    const currentText = showText ? (isToggled ? textOn : textOff) : undefined;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        aria-pressed={isToggled}
        {...props}
      >
        {isToggled && iconOn && React.createElement(iconOn, { size: iconSize })}
        {!isToggled && iconOff && React.createElement(iconOff, { size: iconSize })}
        {currentText && <span>{currentText}</span>}
      </Comp>
    );
  },
);
ToggleButton.displayName = "ToggleButton";

export { ToggleButton };
