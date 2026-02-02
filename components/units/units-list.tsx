"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, FolderTree, Building2 } from "lucide-react"
import { CreateUnitDialog } from "@/components/calendar/create-unit-dialog"
import { deleteUnit, updateUnit } from "@/lib/actions/units"
import { createPropertyGroup, getPropertyGroups, updatePropertyGroup, deletePropertyGroup } from "@/lib/actions/property-groups"
import { useToast } from "@/components/ui/toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { UnitUI } from "@/lib/ui-types"
import { toUnitUI } from "@/lib/ui-mappers"

interface UnitsListProps {
  initialUnits: UnitUI[]
  initialPropertyGroups?: unknown[]
}

export function UnitsList({ initialUnits, initialPropertyGroups = [] }: UnitsListProps) {
  const [units, setUnits] = useState(initialUnits)
  const [propertyGroups, setPropertyGroups] = useState(initialPropertyGroups)
  const [showCreate, setShowCreate] = useState(false)
  const [editingUnit, setEditingUnit] = useState<UnitUI | null>(null)
  const [showGroups, setShowGroups] = useState(false)
  const { addToast } = useToast()
  const router = useRouter()

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas archivar esta unidad?")) return

    try {
      await deleteUnit(id)
      setUnits(units.filter((u) => u.id !== id))
      addToast({ title: "Unidad archivada", description: "La unidad se ha archivado correctamente" })
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo archivar la unidad",
        variant: "destructive",
      })
    }
  }

  type UnitUpdateData = { name: string; address?: string; type?: "DEPTO" | "CASA" | "COCHERA" | "VIVIENDA" | "LOCAL_COMERCIAL" | "OTRO"; propertyGroupId?: string; notes?: string; ivaRatePercent?: string; igRatePercent?: string; iibbRatePercent?: string; monthlyExpensesAmount?: string }
  const handleUpdate = async (unit: UnitUI, data: UnitUpdateData) => {
    try {
      const updateData = {
        name: data.name,
        address: data.address || "",
        type: data.type || "DEPTO",
        propertyGroupId: data.propertyGroupId || "",
        notes: data.notes || "",
        ivaRatePercent: data.ivaRatePercent || "",
        igRatePercent: data.igRatePercent || "",
        iibbRatePercent: data.iibbRatePercent || "",
        monthlyExpensesAmount: data.monthlyExpensesAmount || "",
      }
      
      const updated = await updateUnit(unit.id, updateData)
      const updatedUI = toUnitUI(updated)
      setUnits(units.map((u) => (u.id === updated.id && updatedUI ? updatedUI : u)))
      setEditingUnit(null)
      addToast({ title: "Unidad actualizada", description: "La unidad se ha actualizado correctamente" })
      // Refresh server components to update expenses and BI pages
      router.refresh()
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo actualizar la unidad",
        variant: "destructive",
      })
    }
  }

  const handleCreateGroup = async (name: string) => {
    try {
      const group = await createPropertyGroup({ name })
      const updatedGroups = await getPropertyGroups()
      setPropertyGroups(updatedGroups)
      addToast({ title: "Grupo creado", description: "El grupo se ha creado correctamente" })
      router.refresh()
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo crear el grupo",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-[#1B5E20]" />
            <h1 className="text-4xl font-bold text-[#1B5E20]">Unidades</h1>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowGroups(true)}
              className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-semibold px-6 py-2.5 shadow-md transition-all duration-200 flex items-center gap-2"
            >
              <FolderTree className="h-5 w-5" />
              Grupos de Propiedades
            </Button>
            <Button 
              onClick={() => setShowCreate(true)}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold px-6 py-2.5 shadow-md transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Nueva Unidad
            </Button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#1B5E20] via-[#2E7D32] to-[#4CAF50] rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit) => (
          <Card key={unit.id} className="border-2 border-[#d4e6dc] bg-white hover:shadow-lg transition-shadow duration-200 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#F1F8F4] to-[#E8F5E9] border-b-2 border-[#4CAF50] pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold text-[#1B5E20] mb-1">{unit.name}</CardTitle>
                  <CardDescription className="text-sm font-medium text-[#2E7D32] uppercase tracking-wide">
                    {unit.type}
                  </CardDescription>
                </div>
                {(unit as any).propertyGroup && (
                  <span className="px-2 py-1 text-xs font-semibold bg-[#1B5E20] text-white rounded-full">
                    {(unit as any).propertyGroup.name}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="bg-white pt-4">
              {unit.address && (
                <div className="mb-3 flex items-start gap-2">
                  <span className="text-[#1B5E20] font-medium text-sm">📍</span>
                  <p className="text-sm text-gray-700 flex-1">{unit.address}</p>
                </div>
              )}
              {unit.notes && (
                <div className="mb-4 flex items-start gap-2">
                  <span className="text-[#1B5E20] font-medium text-sm">📝</span>
                  <p className="text-sm text-gray-600 flex-1 line-clamp-2">{unit.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t border-[#d4e6dc]">
                <Button
                  onClick={() => setEditingUnit(unit)}
                  className="flex-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-medium transition-colors duration-200"
                  size="sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  onClick={() => handleDelete(unit.id)}
                  variant="outline"
                  className="border-[#d4e6dc] text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors duration-200"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Archivar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {units.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-br from-[#F1F8F4] to-white rounded-lg border-2 border-dashed border-[#d4e6dc]">
          <Building2 className="h-16 w-16 text-[#4CAF50] mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-gray-700 mb-2">No hay unidades creadas</p>
          <p className="text-sm text-gray-500 mb-6">Comienza creando tu primera unidad</p>
          <Button 
            onClick={() => setShowCreate(true)}
            className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold px-6 py-2.5 shadow-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Crear primera unidad
          </Button>
        </div>
      )}

      {showCreate && (
        <CreateUnitDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSuccess={(unit) => {
            setUnits([...units, unit])
            setShowCreate(false)
          }}
          propertyGroups={(propertyGroups as { id: string; name: string }[]) || []}
        />
      )}

      {editingUnit && (
        <EditUnitDialog
          unit={editingUnit}
          open={!!editingUnit}
          onOpenChange={(open) => !open && setEditingUnit(null)}
          onSave={(data) => handleUpdate(editingUnit, data)}
          propertyGroups={propertyGroups}
        />
      )}

      {showGroups && (
        <PropertyGroupsDialog
          open={showGroups}
          onOpenChange={setShowGroups}
          propertyGroups={propertyGroups}
          onGroupCreated={async () => {
            const updatedGroups = await getPropertyGroups()
            setPropertyGroups(updatedGroups)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function PropertyGroupsDialog({
  open,
  onOpenChange,
  propertyGroups,
  onGroupCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyGroups: any[]
  onGroupCreated: () => void
}) {
  const [newGroupName, setNewGroupName] = useState("")
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const router = useRouter()

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setLoading(true)
    try {
      await createPropertyGroup({ name: newGroupName.trim() })
      setNewGroupName("")
      addToast({ title: "Grupo creado", description: "El grupo se ha creado correctamente" })
      onGroupCreated()
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo crear el grupo",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este grupo?")) return

    try {
      await deletePropertyGroup(id)
      addToast({ title: "Grupo eliminado", description: "El grupo se ha eliminado correctamente" })
      onGroupCreated()
    } catch (error: any) {
      addToast({
        title: "Error",
        description: error.message || "No se pudo eliminar el grupo",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-[#d4e6dc] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F1F8F4] rounded-lg">
              <FolderTree className="h-6 w-6 text-[#1B5E20]" />
            </div>
            <DialogTitle className="text-2xl font-bold text-[#1B5E20]">Grupos de Propiedades</DialogTitle>
          </div>
          <p className="text-sm text-gray-600 mt-2">Organiza tus unidades en grupos para facilitar la gestión y los reportes</p>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <form onSubmit={handleCreateGroup} className="flex gap-3">
            <Input
              placeholder="Nombre del grupo"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              required
              className="flex-1 border-2 border-[#d4e6dc] focus:border-[#1B5E20] focus:ring-[#1B5E20]"
            />
            <Button 
              type="submit" 
              disabled={loading || !newGroupName.trim()}
              className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold px-6 shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5 mr-2" />
              {loading ? "Creando..." : "Crear Grupo"}
            </Button>
          </form>

          <div className="border-t border-[#d4e6dc] pt-4">
            <h3 className="font-semibold text-[#1B5E20] mb-4 text-lg flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Grupos Existentes
            </h3>
            {propertyGroups.length === 0 ? (
              <div className="text-center py-8 bg-[#F1F8F4] rounded-lg border-2 border-dashed border-[#d4e6dc]">
                <FolderTree className="h-12 w-12 text-[#4CAF50] mx-auto mb-3 opacity-50" />
                <p className="text-gray-600 text-sm">No hay grupos creados aún</p>
                <p className="text-gray-500 text-xs mt-1">Crea tu primer grupo para comenzar a organizar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {propertyGroups.map((group) => (
                  <div 
                    key={group.id} 
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-[#F1F8F4] to-white rounded-lg border-2 border-[#d4e6dc] hover:border-[#4CAF50] transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#1B5E20] rounded-lg">
                        <FolderTree className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <span className="font-semibold text-[#1B5E20] text-lg">{group.name}</span>
                        {group.units && group.units.length > 0 && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            {group.units.length} {group.units.length === 1 ? 'unidad' : 'unidades'}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditUnitDialog({
  unit,
  open,
  onOpenChange,
  onSave,
  propertyGroups = [],
}: {
  unit: UnitUI
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { name: string; address?: string; type: "DEPTO" | "CASA" | "COCHERA" | "VIVIENDA" | "LOCAL_COMERCIAL" | "OTRO"; propertyGroupId?: string; notes?: string; ivaRatePercent?: string; igRatePercent?: string; iibbRatePercent?: string; monthlyExpensesAmount?: string }) => void
  propertyGroups?: any[]
}) {
  const [loading, setLoading] = useState(false)
  type UnitType = "DEPTO" | "CASA" | "COCHERA" | "VIVIENDA" | "LOCAL_COMERCIAL" | "OTRO"
  const [formData, setFormData] = useState({
    name: unit.name,
    address: unit.address || "",
    type: (unit.type || "DEPTO") as UnitType,
    propertyGroupId: unit.propertyGroupId || "",
    notes: unit.notes || "",
    ivaRatePercent: unit.ivaRatePercent ? Number(unit.ivaRatePercent).toString() : "",
    igRatePercent: unit.igRatePercent ? Number(unit.igRatePercent).toString() : "",
    iibbRatePercent: unit.iibbRatePercent ? Number(unit.iibbRatePercent).toString() : "",
    monthlyExpensesAmount: unit.monthlyExpensesAmount ? Number(unit.monthlyExpensesAmount).toString() : "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onSave(formData)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Unidad</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="type">Tipo *</Label>
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as UnitType })}
              required
            >
              <option value="DEPTO">Departamento</option>
              <option value="CASA">Casa</option>
              <option value="COCHERA">Cochera</option>
              <option value="VIVIENDA">Vivienda</option>
              <option value="LOCAL_COMERCIAL">Local Comercial</option>
              <option value="OTRO">Otro</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="propertyGroupId">Grupo de Propiedades</Label>
            <Select
              id="propertyGroupId"
              value={formData.propertyGroupId}
              onChange={(e) => setFormData({ ...formData, propertyGroupId: e.target.value })}
            >
              <option value="">Sin Grupo</option>
              {propertyGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          
          {/* Tax Rates Section */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Porcentajes de Impuestos a Cobrar (opcional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ivaRatePercent" className="text-gray-900">IVA %</Label>
                <Input
                  id="ivaRatePercent"
                  type="number"
                  step="0.01"
                  placeholder="21"
                  value={formData.ivaRatePercent}
                  onChange={(e) => setFormData({ ...formData, ivaRatePercent: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="igRatePercent" className="text-gray-900">IG %</Label>
                <Input
                  id="igRatePercent"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.igRatePercent}
                  onChange={(e) => setFormData({ ...formData, igRatePercent: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="iibbRatePercent" className="text-gray-900">IIBB %</Label>
                <Input
                  id="iibbRatePercent"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.iibbRatePercent}
                  onChange={(e) => setFormData({ ...formData, iibbRatePercent: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Estos porcentajes se usarán para calcular automáticamente los impuestos sobre el precio de alquiler.
            </p>
          </div>
          
          {/* Monthly Expenses Section */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Expensas Mensuales (opcional)</h3>
            <div>
              <Label htmlFor="monthlyExpensesAmount" className="text-gray-900">Monto Mensual de Expensas</Label>
              <Input
                id="monthlyExpensesAmount"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.monthlyExpensesAmount}
                onChange={(e) => setFormData({ ...formData, monthlyExpensesAmount: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-2">
                Este monto se descontará mensualmente en el balance de la unidad.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: loading ? undefined : '#1B5E20' }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#2E7D32')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1B5E20')}
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
