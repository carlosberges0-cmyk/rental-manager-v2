"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { format, startOfWeek, addDays, subDays, isToday, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns"
import { Plus, ChevronLeft, ChevronRight, Calendar, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Unit, RentalPeriod } from "@prisma/client"
import { RentalPeriodBlock } from "./rental-period-block"
import { CreateUnitDialog } from "./create-unit-dialog"
import { CreateRentalPeriodDialog } from "./create-rental-period-dialog"
import { RentalPeriodDrawer } from "./rental-period-drawer"

interface CalendarViewProps {
  units: Unit[]
  initialRentalPeriods: (RentalPeriod & { unit: Unit; tenant: { name: string } | null })[]
}

const DAYS_TO_RENDER = 90 // Render 90 days initially (can be extended)
const COLUMN_WIDTH = 120 // pixels per day - wider for better visibility

export function InfiniteCalendarView({ units: initialUnits, initialRentalPeriods }: CalendarViewProps) {
  const [units, setUnits] = useState(initialUnits)
  // Convert dates from strings to Date objects when initializing
  const [rentalPeriods, setRentalPeriods] = useState(() => 
    (initialRentalPeriods || []).map(period => ({
      ...period,
      startDate: period.startDate instanceof Date 
        ? period.startDate 
        : new Date(period.startDate),
      endDate: period.endDate instanceof Date 
        ? period.endDate 
        : new Date(period.endDate),
    }))
  )
  const [currentStartDate, setCurrentStartDate] = useState(() => {
    const today = new Date()
    return startOfWeek(today) // Start from today's week
  })
  const [visibleDays, setVisibleDays] = useState(() => {
    const today = new Date()
    const start = startOfWeek(today)
    return eachDayOfInterval({ start, end: addDays(start, DAYS_TO_RENDER - 1) })
  })
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof initialRentalPeriods)[0] | null>(null)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [showCreateRental, setShowCreateRental] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Load more days when scrolling near edges
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const scrollLeft = container.scrollLeft
    const scrollWidth = container.scrollWidth
    const clientWidth = container.clientWidth

    // Load more days to the right if scrolled near right edge
    if (scrollLeft + clientWidth > scrollWidth - 500) {
      const lastDay = visibleDays[visibleDays.length - 1]
      const newDays = eachDayOfInterval({
        start: addDays(lastDay, 1),
        end: addDays(lastDay, DAYS_TO_RENDER),
      })
      setVisibleDays([...visibleDays, ...newDays])
    }

    // Load more days to the left if scrolled near left edge
    if (scrollLeft < 500) {
      const firstDay = visibleDays[0]
      const newDays = eachDayOfInterval({
        start: subDays(firstDay, DAYS_TO_RENDER),
        end: subDays(firstDay, 1),
      }).reverse()
      setVisibleDays([...newDays, ...visibleDays])
      // Adjust scroll position to maintain visual position
      setTimeout(() => {
        if (container) {
          container.scrollLeft = scrollLeft + (newDays.length * COLUMN_WIDTH)
        }
      }, 0)
    }
  }, [visibleDays])

  // Jump to specific month
  const handleMonthClick = (monthIndex: number) => {
    const targetDate = new Date(selectedYear, monthIndex, 1)
    const start = startOfWeek(targetDate)
    const newDays = eachDayOfInterval({
      start,
      end: addDays(start, DAYS_TO_RENDER - 1),
    })
    setVisibleDays(newDays)
    setCurrentStartDate(start)
    setSelectedMonth(monthIndex)
    // Scroll to the month
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const today = new Date()
        const daysDiff = Math.ceil((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        scrollContainerRef.current.scrollLeft = daysDiff * COLUMN_WIDTH
      }
    }, 100)
  }

      // Jump to today
      const handleTodayClick = () => {
        const today = new Date()
        const start = startOfWeek(today)
        const newDays = eachDayOfInterval({
          start,
          end: addDays(start, DAYS_TO_RENDER - 1),
        })
        setVisibleDays(newDays)
        setCurrentStartDate(start)
        setSelectedYear(today.getFullYear())
        setSelectedMonth(today.getMonth())

        // Scroll to today
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const todayIndex = newDays.findIndex(
              (d) => format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
            )
            if (todayIndex >= 0) {
              scrollContainerRef.current.scrollLeft = todayIndex * COLUMN_WIDTH
            }
          }
        }, 100)
      }

  const getRentalPeriodsForUnit = (unitId: string) => {
    return rentalPeriods.filter((rp) => {
      // Ensure unitId matches
      const unitMatches = rp.unitId === unitId
      // Ensure status is not cancelled
      const statusMatches = rp.status !== "CANCELLED"
      return unitMatches && statusMatches
    }).sort((a, b) => {
      // Sort by start date
      const aStart = a.startDate instanceof Date ? a.startDate : new Date(a.startDate)
      const bStart = b.startDate instanceof Date ? b.startDate : new Date(b.startDate)
      return aStart.getTime() - bStart.getTime()
    })
  }

  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b-0 text-white p-4 flex-shrink-0" style={{ backgroundColor: '#1B5E20' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Rental Manager</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Year selector */}
            <select
              value={selectedYear}
              onChange={(e) => {
                const year = parseInt(e.target.value)
                setSelectedYear(year)
                const targetDate = new Date(year, selectedMonth, 1)
                handleMonthClick(selectedMonth)
              }}
              className="bg-white/10 text-white border border-white/20 rounded px-2 py-1"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            {/* Today button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTodayClick}
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Hoy
            </Button>

            {/* Month selector */}
            <div className="flex gap-1">
              {months.map((month, index) => (
                <Button
                  key={month}
                  variant={selectedMonth === index ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleMonthClick(index)}
                  className={
                    selectedMonth === index
                      ? "bg-white text-[#1B5E20] hover:bg-white/90"
                      : "bg-transparent hover:bg-white/10 text-white"
                  }
                >
                  {month}
                </Button>
              ))}
            </div>

            {/* Scroll arrows */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({ left: -700, behavior: "smooth" })
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({ left: 700, behavior: "smooth" })
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* New rental/unit buttons */}
            <Button
              onClick={() => setShowCreateUnit(true)}
              variant="secondary"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </Button>
            <Button
              onClick={() => setShowCreateRental(true)}
              className="bg-white text-[#1B5E20] hover:bg-white/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Alquiler
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Units column */}
        <div className="w-48 border-r border-l-0 overflow-hidden sticky left-0 z-20 bg-[#F1F8F4]" style={{ 
          borderRight: '2px solid #d4e6dc',
        }}>
          <div 
            className="sticky top-0 border-b-2 border-[#1B5E20] flex items-center justify-center font-bold text-base text-[#1B5E20] bg-white shadow-lg"
            style={{ 
              height: "80px",
              minHeight: "80px",
              maxHeight: "80px",
            }}
          >
            Unidades
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {units.map((unit, unitIndex) => (
              <div
                key={unit.id}
                className="border-b-2 border-[#d4e6dc] flex items-center justify-between group transition-all hover:bg-[#E8F5E9]"
                style={{ 
                  height: "80px",
                  minHeight: "80px",
                  maxHeight: "80px",
                  padding: '0 16px',
                  backgroundColor: '#F1F8F4'
                }}
              >
                <div className="font-semibold text-[#1B5E20] text-lg">{unit.name}</div>
                <button
                  onClick={async () => {
                    if (confirm(`¿Estás seguro de que deseas eliminar la unidad "${unit.name}"?`)) {
                      try {
                        const { deleteUnit } = await import("@/lib/actions/units")
                        await deleteUnit(unit.id)
                        setUnits(units.filter(u => u.id !== unit.id))
                        setRentalPeriods(rentalPeriods.filter(rp => rp.unitId !== unit.id))
                        const { useToast } = await import("@/components/ui/toast")
                      } catch (error) {
                        console.error("Error deleting unit:", error)
                        alert("No se pudo eliminar la unidad")
                      }
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50"
                  title="Eliminar unidad"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable timeline */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          onScroll={handleScroll}
        >
          <div ref={timelineRef} style={{ minWidth: `${visibleDays.length * COLUMN_WIDTH}px` }}>
            {/* Header with dates */}
            <div className="sticky top-0 bg-white border-b-2 border-[#1B5E20] z-10 shadow-lg">
              <div className="flex">
                {visibleDays.map((day, index) => {
                  const isTodayDate = isToday(day)
                  const dayOfWeek = format(day, "EEE")
                  const isFirstOfMonth = day.getDate() === 1
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className="text-center flex-shrink-0 relative transition-all"
                      style={{ 
                        width: `${COLUMN_WIDTH}px`, 
                        minWidth: `${COLUMN_WIDTH}px`,
                        height: '80px',
                        borderRight: index < visibleDays.length - 1 ? '1px solid #e5e7eb' : 'none',
                        backgroundColor: isWeekend ? '#fafafa' : 'white',
                      }}
                    >
                      {/* Month separator */}
                      {isFirstOfMonth && index > 0 && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1B5E20] z-20 opacity-40" />
                      )}
                      
                      <div className="flex flex-col items-center justify-center h-full py-2">
                        <div className="text-[10px] font-medium text-gray-500 uppercase mb-1 tracking-wider">
                          {dayOfWeek}
                        </div>
                        <div
                          className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                            isTodayDate 
                              ? "text-white bg-[#1B5E20] shadow-md" 
                              : isWeekend 
                                ? "text-gray-400" 
                                : "text-gray-800"
                          }`}
                        >
                          {format(day, "d")}
                        </div>
                        {isFirstOfMonth && (
                          <div className="text-[9px] text-[#1B5E20] font-semibold mt-1">
                            {format(day, "MMM")}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows for each unit */}
            {units.map((unit, unitIndex) => {
              const unitPeriods = getRentalPeriodsForUnit(unit.id)
              const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6
              
              // Get the active period for this unit (only one at a time per unit)
              const getActivePeriodForDay = (day: Date) => {
                const dayStr = format(day, "yyyy-MM-dd")
                return unitPeriods.find((rp) => {
                  const start = rp.startDate instanceof Date ? rp.startDate : new Date(rp.startDate)
                  const end = rp.endDate instanceof Date ? rp.endDate : new Date(rp.endDate)
                  const startStr = format(start, "yyyy-MM-dd")
                  const endStr = format(end, "yyyy-MM-dd")
                  return dayStr >= startStr && dayStr <= endStr
                })
              }
              
              return (
                <div 
                  key={unit.id} 
                  className="flex relative" 
                  style={{ 
                    height: "80px",
                    minHeight: "80px",
                    maxHeight: "80px",
                    borderBottom: '2px solid #d4e6dc'
                  }}
                >
                  {visibleDays.map((day, dayIndex) => {
                    const isWeekendDay = isWeekend(day)
                    const isFirstOfMonth = day.getDate() === 1
                    const activePeriod = getActivePeriodForDay(day)
                    const isFirstDayOfPeriod = activePeriod && format(day, "yyyy-MM-dd") === format(
                      activePeriod.startDate instanceof Date ? activePeriod.startDate : new Date(activePeriod.startDate),
                      "yyyy-MM-dd"
                    )
                    const isLastDayOfPeriod = activePeriod && format(day, "yyyy-MM-dd") === format(
                      activePeriod.endDate instanceof Date ? activePeriod.endDate : new Date(activePeriod.endDate),
                      "yyyy-MM-dd"
                    )
                    
                    // Determine background color based on period status
                    let cellBgColor = isWeekendDay ? '#fafafa' : 'white'
                    if (activePeriod) {
                      if (activePeriod.status === "ACTIVE") {
                        cellBgColor = '#4CAF50'
                      } else if (activePeriod.status === "RESERVED") {
                        cellBgColor = '#FFC107'
                      } else if (activePeriod.status === "CANCELLED") {
                        cellBgColor = '#E0E0E0'
                      }
                    }
                    
                    return (
                    <div
                      key={`${unit.id}-${day.toISOString()}`}
                      className="relative flex-shrink-0 transition-all duration-150 cursor-pointer"
                      style={{ 
                        width: `${COLUMN_WIDTH}px`, 
                        minWidth: `${COLUMN_WIDTH}px`, 
                        height: "80px",
                        minHeight: "80px",
                        maxHeight: "80px",
                        borderRight: dayIndex < visibleDays.length - 1 ? '1px solid #e5e7eb' : 'none',
                        backgroundColor: cellBgColor,
                        borderLeft: isFirstDayOfPeriod ? '3px solid #1B5E20' : 'none',
                        borderRight: isLastDayOfPeriod && dayIndex < visibleDays.length - 1 ? '3px solid #1B5E20' : 'none',
                      }}
                      onClick={() => activePeriod && setSelectedPeriod(activePeriod as any)}
                      onMouseEnter={(e) => {
                        if (activePeriod) {
                          e.currentTarget.style.opacity = '0.85'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activePeriod) {
                          e.currentTarget.style.opacity = '1'
                        }
                      }}
                    >
                      {/* Month separator line */}
                      {isFirstOfMonth && dayIndex > 0 && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#1B5E20] opacity-20 z-10" />
                      )}
                      
                      {/* Show period info only on first day */}
                      {isFirstDayOfPeriod && activePeriod && (
                        <div className="absolute inset-0 flex flex-col justify-center px-3 z-20">
                          <div className="text-white font-bold text-sm mb-1 truncate drop-shadow-md">
                            {activePeriod.tenant?.name || "Sin inquilino"}
                          </div>
                          <div className="text-white text-xs font-semibold mb-1 drop-shadow-md">
                            {Number(activePeriod.priceAmount).toLocaleString()} {activePeriod.currency}
                          </div>
                          <div className="text-white text-[10px] flex items-center justify-center gap-1 bg-black/15 rounded px-2 py-0.5">
                            <span className="font-medium">{format(activePeriod.startDate instanceof Date ? activePeriod.startDate : new Date(activePeriod.startDate), "d/M")}</span>
                            <span>→</span>
                            <span className="font-medium">{format(activePeriod.endDate instanceof Date ? activePeriod.endDate : new Date(activePeriod.endDate), "d/M")}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating action button with menu */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg text-white"
          style={{ backgroundColor: '#1B5E20' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2E7D32'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B5E20'}
          onClick={() => setShowCreateRental(true)}
          title="Nuevo Alquiler"
        >
          <Plus className="h-6 w-6" />
        </Button>
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
          onSuccess={async (period) => {
            // Fetch the full period with relations to ensure it has the correct structure
            try {
              const { getRentalPeriod } = await import("@/lib/actions/rental-periods")
              const fullPeriod = await getRentalPeriod(period.id)
              
              if (fullPeriod) {
                // Convert dates from strings to Date objects (they come as strings from server)
                const newPeriod: any = {
                  ...fullPeriod,
                  startDate: fullPeriod.startDate instanceof Date 
                    ? fullPeriod.startDate 
                    : new Date(fullPeriod.startDate),
                  endDate: fullPeriod.endDate instanceof Date 
                    ? fullPeriod.endDate 
                    : new Date(fullPeriod.endDate),
                }
                
                // Add to state using functional update
                setRentalPeriods((prev) => {
                  // Check if period already exists
                  const exists = prev.some(p => p.id === newPeriod.id)
                  if (exists) {
                    return prev.map(p => p.id === newPeriod.id ? newPeriod : p)
                  }
                  return [...prev, newPeriod]
                })
                
                // Get start date and check if it's visible
                const startDate = newPeriod.startDate instanceof Date 
                  ? newPeriod.startDate 
                  : new Date(newPeriod.startDate)
                const startDateStr = format(startDate, "yyyy-MM-dd")
                
                // Check if date is in visible range
                const isVisible = visibleDays.some(d => format(d, "yyyy-MM-dd") === startDateStr)
                
                if (!isVisible) {
                  // Need to scroll to show the date
                  const targetDate = startOfWeek(startDate)
                  const newDays = eachDayOfInterval({
                    start: targetDate,
                    end: addDays(targetDate, DAYS_TO_RENDER - 1),
                  })
                  setVisibleDays(newDays)
                  
                  // Scroll to the date after a short delay
                  setTimeout(() => {
                    if (scrollContainerRef.current) {
                      const dayIndex = newDays.findIndex(
                        (d) => format(d, "yyyy-MM-dd") === startDateStr
                      )
                      if (dayIndex >= 0) {
                        scrollContainerRef.current.scrollLeft = dayIndex * COLUMN_WIDTH
                      }
                    }
                  }, 100)
                }
              }
            } catch (error) {
              console.error("Error fetching period:", error)
            }
            
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
            // Ensure dates are Date objects when updating
            const updatedPeriod = {
              ...updated,
              startDate: updated.startDate instanceof Date 
                ? updated.startDate 
                : new Date(updated.startDate),
              endDate: updated.endDate instanceof Date 
                ? updated.endDate 
                : new Date(updated.endDate),
            }
            setRentalPeriods(
              rentalPeriods.map((rp) => (rp.id === updatedPeriod.id ? updatedPeriod : rp))
            )
            setSelectedPeriod(null)
          }}
          onDelete={(id) => {
            setRentalPeriods(rentalPeriods.filter((rp) => rp.id !== id))
            setSelectedPeriod(null)
          }}
        />
      )}
    </div>
  )
}
