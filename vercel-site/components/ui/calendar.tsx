"use client"

import * as React from "react"
import { DayPicker, DayPickerProps } from "react-day-picker"
import "react-day-picker/style.css";
import { cn } from "@/lib/utils/utils"

function Calendar(props: DayPickerProps) {
  const {
    className,
    ...restProps
  } = props;

  return (
    <div className="rdp-root">
      <DayPicker
        className={cn("p-3", className)}
        {...restProps}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
