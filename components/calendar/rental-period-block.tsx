"use client"

import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { RentalPeriodUI } from "@/lib/ui-types"

interface RentalPeriodBlockProps {
  rentalPeriod: RentalPeriodUI
  day: Date
  isFirstDay: boolean
  isLastDay: boolean
  onClick: () => void
  totalDays?: number
  leftOffset?: number
}

const statusColors = {
  RESERVED: "bg-yellow-300 hover:bg-yellow-400 border-yellow-500 text-yellow-900",
  ACTIVE: "border-2 text-white",
  CANCELLED: "bg-gray-300 hover:bg-gray-400 border-gray-500 text-gray-700",
}

export function RentalPeriodBlock({
  rentalPeriod,
  day,
  isFirstDay,
  isLastDay,
  onClick,
  totalDays,
  leftOffset,
}: RentalPeriodBlockProps) {
  const startDate = new Date(rentalPeriod.startDate)
  const endDate = new Date(rentalPeriod.endDate)
  
  // Calculate width and position for infinite calendar
  const style: React.CSSProperties = {}
  if (totalDays !== undefined && leftOffset !== undefined && isFirstDay) {
    // Only render on first day, spanning multiple columns
    style.width = `${totalDays * 120}px` // Use COLUMN_WIDTH (120px)
    style.left = `${leftOffset}px`
    style.position = "absolute"
    style.top = "4px"
    style.zIndex = 10
    style.height = "72px"
  } else if (!isFirstDay) {
    // Don't render on non-first days (will be rendered by first day)
    return null
  } else {
    // Fallback for legacy rendering
    style.width = "calc(100% - 8px)"
    style.left = "4px"
    style.position = "absolute"
    style.top = "4px"
    style.height = "72px"
  }

  // Status-based styling
  const getBlockStyle = () => {
    const baseStyle = { ...style }
    
    if (rentalPeriod.status === "ACTIVE") {
      return {
        ...baseStyle,
        backgroundColor: '#2E7D32',
        borderLeft: '4px solid #1B5E20',
        borderRight: '2px solid #1B5E20',
        borderRadius: '6px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }
    } else if (rentalPeriod.status === "RESERVED") {
      return {
        ...baseStyle,
        backgroundColor: '#FEF3C7',
        borderLeft: '4px solid #F59E0B',
        borderRight: '2px solid #F59E0B',
        borderRadius: '6px',
        color: '#92400E',
      }
    } else {
      return {
        ...baseStyle,
        backgroundColor: '#E5E7EB',
        borderLeft: '4px solid #9CA3AF',
        borderRight: '2px solid #9CA3AF',
        borderRadius: '6px',
        color: '#4B5563',
        opacity: 0.6,
      }
    }
  }

  const blockStyle = getBlockStyle()

  return (
    <div
      className={cn(
        "cursor-pointer px-2 py-1.5 text-xs flex flex-col justify-between",
        rentalPeriod.status === "ACTIVE" && "hover:opacity-90 hover:shadow-md transition-all",
        rentalPeriod.status === "RESERVED" && "hover:opacity-90",
      )}
      style={blockStyle}
      onClick={onClick}
      title={`${rentalPeriod.tenant?.name || "Sin inquilino"} - ${format(startDate, "d/M/yyyy")} al ${format(endDate, "d/M/yyyy")} - ${Number(rentalPeriod.priceAmount).toLocaleString()} ${rentalPeriod.currency}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate text-[11px] mb-0.5" style={{ 
            color: rentalPeriod.status === "ACTIVE" ? 'white' : rentalPeriod.status === "RESERVED" ? '#92400E' : '#4B5563'
          }}>
            {rentalPeriod.tenant?.name || "Sin inquilino"}
          </div>
          <div className="text-[10px] font-medium opacity-90" style={{ 
            color: rentalPeriod.status === "ACTIVE" ? 'white' : rentalPeriod.status === "RESERVED" ? '#92400E' : '#4B5563'
          }}>
            {Number(rentalPeriod.priceAmount).toLocaleString()} {rentalPeriod.currency}
          </div>
        </div>
      </div>
      
      {/* Date range indicator */}
      <div className="flex items-center justify-between mt-1 pt-1 border-t" style={{ 
        borderColor: rentalPeriod.status === "ACTIVE" ? 'rgba(255,255,255,0.3)' : rentalPeriod.status === "RESERVED" ? 'rgba(146,64,14,0.3)' : 'rgba(75,85,99,0.3)'
      }}>
        <div className="text-[9px] font-medium opacity-80" style={{ 
          color: rentalPeriod.status === "ACTIVE" ? 'white' : rentalPeriod.status === "RESERVED" ? '#92400E' : '#4B5563'
        }}>
          {format(startDate, "d/M")}
        </div>
        {isLastDay && (
          <div className="text-[9px] font-medium opacity-80" style={{ 
            color: rentalPeriod.status === "ACTIVE" ? 'white' : rentalPeriod.status === "RESERVED" ? '#92400E' : '#4B5563'
          }}>
            {format(endDate, "d/M")}
          </div>
        )}
      </div>
    </div>
  )
}
