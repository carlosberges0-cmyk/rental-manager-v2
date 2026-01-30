"use client"

import { useState, useRef, useEffect } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth, isToday, addDays, subDays } from "date-fns"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RentalPeriodBlock } from "./rental-period-block"
import { CreateUnitDialog } from "./create-unit-dialog"
import { CreateRentalPeriodDialog } from "./create-rental-period-dialog"
import { RentalPeriodDrawer } from "./rental-period-drawer"
import type { UnitUI, RentalPeriodUI } from "@/lib/ui-types"

type ViewMode = "day" | "week" | "month"

interface CalendarViewProps {
  units: UnitUI[]
  initialRentalPeriods: RentalPeriodUI[]
}

export function CalendarView({ units: initialUnits, initialRentalPeriods }: CalendarViewProps) {
  const [units, setUnits] = useState(initialUnits)
  const [rentalPeriods, setRentalPeriods] = useState(initialRentalPeriods)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof initialRentalPeriods)[0] | null>(null)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [showCreateRental, setShowCreateRental] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

  const getDaysForView = () => {
    if (viewMode === "day") {
      return [currentDate]
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate)
      return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })
    } else {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const calendarStart = startOfWeek(monthStart)
      const calendarEnd = endOfWeek(monthEnd)
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }
  }

  const days = getDaysForView()

  const handleScroll = (direction: "left" | "right") => {
    if (viewMode === "day") {
      setCurrentDate(direction === "left" ? subDays(currentDate, 1) : addDays(currentDate, 1))
    } else if (viewMode === "week") {
      setCurrentDate(direction === "left" ? subDays(currentDate, 7) : addDays(currentDate, 7))
    } else {
      setCurrentDate(direction === "left" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    }
  }

  const getRentalPeriodsForUnit = (unitId: string) => {
    return rentalPeriods.filter((rp) => rp.unitId === unitId && rp.status !== "CANCELLED")
  }

  const getColumnWidth = () => {
    if (viewMode === "day") return "200px"
    if (viewMode === "week") return "150px"
    return "100px"
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => handleScroll("left")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">
              {viewMode === "day"
                ? format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy")
                : viewMode === "week"
                ? `${format(days[0], "d MMM")} - ${format(days[days.length - 1], "d MMM yyyy")}`
                : format(currentDate, "MMMM yyyy")}
            </h1>
            <Button variant="outline" size="icon" onClick={() => handleScroll("right")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentDate(new Date())}
            >
              Hoy
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("day")}
            >
              Día
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("week")}
            >
              Semana
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              Mes
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Units column */}
        <div className="w-64 border-r bg-muted/50 overflow-y-auto">
          <div className="sticky top-0 bg-background border-b p-4 font-semibold">
            Unidades
          </div>
          {units.map((unit) => (
            <div
              key={unit.id}
              className="border-b p-4 h-20 flex items-center"
            >
              <div>
                <div className="font-medium">{unit.name}</div>
                <div className="text-sm text-muted-foreground">{unit.type}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-auto" ref={timelineRef}>
          <div className="min-w-full">
            {/* Header with dates */}
            <div className="sticky top-0 bg-background border-b z-10">
              <div className="flex">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-r p-2 text-center min-w-[100px]"
                    style={{ minWidth: getColumnWidth() }}
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        isToday(day) ? "text-primary" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows for each unit */}
            {units.map((unit) => (
              <div key={unit.id} className="flex border-b">
                {days.map((day) => (
                  <div
                    key={`${unit.id}-${day.toISOString()}`}
                    className="border-r min-h-[80px] relative"
                    style={{ minWidth: getColumnWidth() }}
                  >
                    {/* Render rental periods that overlap this day */}
                    {getRentalPeriodsForUnit(unit.id)
                      .filter((rp) => {
                        const start = new Date(rp.startDate)
                        const end = new Date(rp.endDate)
                        return day >= start && day <= end
                      })
                      .map((rp) => {
                        const start = new Date(rp.startDate)
                        const end = new Date(rp.endDate)
                        const isFirstDay = format(day, "yyyy-MM-dd") === format(start, "yyyy-MM-dd")
                        const isLastDay = format(day, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")
                        
                        return (
                          <RentalPeriodBlock
                            key={rp.id}
                            rentalPeriod={rp}
                            day={day}
                            isFirstDay={isFirstDay}
                            isLastDay={isLastDay}
                            onClick={() => setSelectedPeriod(rp)}
                          />
                        )
                      })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating action button */}
      <div className="fixed bottom-8 right-8">
        <div className="relative">
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => {
              // Simple toggle for now - could be a menu
              setShowCreateRental(true)
            }}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      {showCreateUnit && (
        <CreateUnitDialog
          open={showCreateUnit}
          onOpenChange={setShowCreateUnit}
          onSuccess={(unit) => {
            setUnits([...units, unit])
            setShowCreateUnit(false)
          }}
        />
      )}

      {showCreateRental && (
        <CreateRentalPeriodDialog
          open={showCreateRental}
          onOpenChange={setShowCreateRental}
          units={units}
          onSuccess={(period) => {
            setRentalPeriods([...rentalPeriods, period])
            setShowCreateRental(false)
          }}
        />
      )}

      {selectedPeriod && (
        <RentalPeriodDrawer
          rentalPeriod={selectedPeriod}
          open={!!selectedPeriod}
          onOpenChange={(open) => !open && setSelectedPeriod(null)}
          onUpdate={(updated) => {
            setRentalPeriods(
              rentalPeriods.map((rp) => (rp.id === updated.id ? updated : rp))
            )
            setSelectedPeriod(null)
          }}
        />
      )}
    </div>
  )
}
