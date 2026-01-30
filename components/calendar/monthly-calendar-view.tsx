"use client"

import { useState } from "react"
import { format, startOfMonth, endOfMonth, isSameMonth, getYear } from "date-fns"
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateUnitDialog } from "./create-unit-dialog"
import { CreateRentalPeriodDialog } from "./create-rental-period-dialog"
import { RentalPeriodDrawer } from "./rental-period-drawer"
import type { RentalPeriodUI, UnitUI } from "@/lib/ui-types"

interface MonthlyCalendarViewProps {
  units: UnitUI[]
  initialRentalPeriods: RentalPeriodUI[]
}

const MONTH_WIDTH = 150 // pixels per month (reduced to fit 12 months)

export function MonthlyCalendarView({ units: initialUnits, initialRentalPeriods }: MonthlyCalendarViewProps) {
  const [units, setUnits] = useState(initialUnits)
  const [rentalPeriods, setRentalPeriods] = useState(initialRentalPeriods)
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()))
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof initialRentalPeriods)[0] | null>(null)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [showCreateRental, setShowCreateRental] = useState(false)

  // Generate 12 months for the selected year (January to December)
  const visibleMonths: Date[] = []
  for (let month = 0; month < 12; month++) {
    visibleMonths.push(new Date(selectedYear, month, 1))
  }

  const getRentalPeriodsForUnit = (unitId: string) => {
    return rentalPeriods.filter((rp) => rp.unitId === unitId && rp.status !== "CANCELLED")
  }

  const getRentalPeriodsForMonth = (unitId: string, month: Date) => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    
    return getRentalPeriodsForUnit(unitId).filter((rp) => {
      const start = new Date(rp.startDate)
      const end = new Date(rp.endDate)
      return start <= monthEnd && end >= monthStart
    })
  }

  const handlePreviousYear = () => {
    setSelectedYear(selectedYear - 1)
  }

  const handleNextYear = () => {
    setSelectedYear(selectedYear + 1)
  }

  const handleToday = () => {
    setSelectedYear(getYear(new Date()))
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] rounded-lg shadow-sm">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendario Anual</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestión de alquileres por año</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Year Navigation */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
            <Button
              onClick={handlePreviousYear}
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:bg-white hover:text-[#1B5E20] h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-1.5 min-w-[100px] text-center">
              <span className="text-lg font-semibold text-gray-900">{selectedYear}</span>
            </div>
            <Button
              onClick={handleNextYear}
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:bg-white hover:text-[#1B5E20] h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={handleToday}
            variant="outline"
            className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-[#1B5E20] hover:text-[#1B5E20]"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Hoy
          </Button>
          <Button
            onClick={() => setShowCreateUnit(true)}
            variant="outline"
            className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-[#1B5E20] hover:text-[#1B5E20]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Unidad
          </Button>
          <Button
            onClick={() => setShowCreateRental(true)}
            className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] hover:from-[#2E7D32] hover:to-[#388E3C] text-white shadow-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Alquiler
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden relative bg-white">
        {/* Sticky Unit Names Column */}
        <div className="absolute left-0 top-0 bottom-0 z-20 bg-white border-r border-gray-200 shadow-sm" style={{ width: '220px' }}>
          <div className="sticky top-0 bg-gradient-to-br from-gray-50 to-white text-gray-900 px-4 py-3 font-semibold text-sm border-b border-gray-200 h-[72px] flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1B5E20]"></div>
              <span>Unidades</span>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 192px)' }}>
            {units.map((unit) => (
              <div
                key={unit.id}
                className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors h-[72px] flex items-center group"
                style={{ minHeight: '72px', maxHeight: '72px' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#1B5E20] transition-colors">{unit.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{unit.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar with 12 Months */}
        <div
          className="overflow-x-auto overflow-y-auto h-full bg-gray-50"
          style={{ marginLeft: '220px' }}
        >
          <div style={{ minWidth: `${visibleMonths.length * MONTH_WIDTH}px`, position: 'relative' }}>
            {/* Month Headers */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
              <div className="flex">
                {visibleMonths.map((month, index) => {
                  const isCurrentMonth = isSameMonth(month, new Date())
                  return (
                    <div
                      key={format(month, "yyyy-MM")}
                      className={`flex-shrink-0 text-center px-2 py-3 border-r border-gray-200 h-[72px] flex flex-col justify-center transition-colors ${
                        isCurrentMonth ? 'bg-gradient-to-b from-[#F1F8F4] to-white' : 'bg-white hover:bg-gray-50'
                      }`}
                      style={{ width: `${MONTH_WIDTH}px`, minWidth: `${MONTH_WIDTH}px`, maxWidth: `${MONTH_WIDTH}px` }}
                    >
                      <div className={`text-sm font-semibold ${isCurrentMonth ? 'text-[#1B5E20]' : 'text-gray-700'}`}>
                        {format(month, "MMM")}
                      </div>
                      {isCurrentMonth && (
                        <div className="mt-1.5 w-8 h-1 bg-[#1B5E20] mx-auto rounded-full"></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Units Rows */}
            <div className="bg-white">
              {units.map((unit, unitIndex) => (
                <div
                  key={unit.id}
                  className={`flex border-b border-gray-100 ${unitIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  style={{ minHeight: '72px', maxHeight: '72px' }}
                >
                  {visibleMonths.map((month, monthIndex) => {
                    const periods = getRentalPeriodsForMonth(unit.id, month)
                    const isCurrentMonth = isSameMonth(month, new Date())
                    const hasActivePeriod = periods.some(p => p.status === "ACTIVE")
                    const hasReservedPeriod = periods.some(p => p.status === "RESERVED")
                    const primaryPeriod = periods.find(p => p.status === "ACTIVE") || periods[0]
                    
                    return (
                      <div
                        key={`${unit.id}-${format(month, "yyyy-MM")}`}
                        onClick={() => primaryPeriod && setSelectedPeriod(primaryPeriod)}
                        className={`flex-shrink-0 p-2 border-r border-gray-100 transition-all overflow-hidden cursor-pointer ${
                          hasActivePeriod
                            ? 'bg-gradient-to-br from-[#4CAF50] to-[#388E3C] hover:from-[#388E3C] hover:to-[#2E7D32]'
                            : hasReservedPeriod
                            ? 'bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600'
                            : isCurrentMonth
                            ? 'bg-blue-50/30 hover:bg-blue-50/50'
                            : 'hover:bg-gray-50'
                        }`}
                        style={{ width: `${MONTH_WIDTH}px`, minWidth: `${MONTH_WIDTH}px`, maxWidth: `${MONTH_WIDTH}px`, minHeight: '72px', maxHeight: '72px' }}
                      >
                        {periods.length === 0 ? (
                          <div className={`text-[10px] h-full flex items-center justify-center ${
                            hasActivePeriod || hasReservedPeriod ? 'text-white opacity-80' : 'text-gray-400'
                          }`}>
                            <span className="opacity-50">—</span>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col justify-center space-y-1">
                            {primaryPeriod && (() => {
                              const start = new Date(primaryPeriod.startDate)
                              const end = new Date(primaryPeriod.endDate)
                              const monthStart = startOfMonth(month)
                              const monthEnd = endOfMonth(month)
                              
                              // Determine if period spans the entire month
                              const spansFullMonth = start <= monthStart && end >= monthEnd
                              const textColor = hasActivePeriod || hasReservedPeriod ? 'text-white' : 'text-gray-900'
                              
                              return (
                                <>
                                  <div className={`text-[11px] font-bold truncate leading-tight ${textColor}`}>
                                    {primaryPeriod.tenant?.name || "Sin inquilino"}
                                  </div>
                                  <div className={`text-[10px] mt-0.5 font-semibold leading-tight ${textColor} ${hasActivePeriod || hasReservedPeriod ? 'opacity-95' : 'opacity-80'}`}>
                                    {Number(primaryPeriod.priceAmount).toLocaleString()} {primaryPeriod.currency}
                                  </div>
                                  {!spansFullMonth && (
                                    <div className={`text-[9px] mt-1 leading-tight font-medium ${textColor} ${hasActivePeriod || hasReservedPeriod ? 'opacity-85' : 'opacity-70'}`}>
                                      {format(start, "d/M")} - {format(end, "d/M")}
                                    </div>
                                  )}
                                  {periods.length > 1 && (
                                    <div className={`text-[8px] mt-1 leading-tight font-medium ${textColor} ${hasActivePeriod || hasReservedPeriod ? 'opacity-75' : 'opacity-60'}`}>
                                      +{periods.length - 1} más
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showCreateUnit && (
        <CreateUnitDialog
          open={showCreateUnit}
          onOpenChange={setShowCreateUnit}
          onSuccess={(newUnit) => {
            setUnits([...units, newUnit])
            setShowCreateUnit(false)
          }}
        />
      )}

      {showCreateRental && (
        <CreateRentalPeriodDialog
          open={showCreateRental}
          onOpenChange={setShowCreateRental}
          units={units}
          onSuccess={(newPeriod) => {
            setRentalPeriods([...rentalPeriods, newPeriod])
            setShowCreateRental(false)
          }}
        />
      )}

      {selectedPeriod && (
        <RentalPeriodDrawer
          rentalPeriod={selectedPeriod}
          open={!!selectedPeriod}
          onOpenChange={(open) => {
            if (!open) setSelectedPeriod(null)
          }}
          onUpdate={(updatedPeriod) => {
            setRentalPeriods(
              rentalPeriods.map((p) => (p.id === updatedPeriod.id ? updatedPeriod : p))
            )
            setSelectedPeriod(null)
          }}
          onDelete={(deletedId) => {
            setRentalPeriods(rentalPeriods.filter((p) => p.id !== deletedId))
            setSelectedPeriod(null)
          }}
        />
      )}
    </div>
  )
}
