# Contabilidad

Módulo contable con catálogo de cuentas, partidas y cierres.

## Requisitos
- Permiso: `manage_account_chart`
- Permiso: `manage_accounting_entries`

## Catálogo de Cuentas

### Gestión de cuentas contables

1. Vaya a **Contabilidad > Catálogo de Cuentas**
2. Visualice el árbol de cuentas
3. Las cuentas se organizan jerárquicamente:
   - **Nivel 1**: Activo, Pasivo, Capital, Ingresos, Costos, Gastos
   - **Niveles inferiores**: Subcuentas
4. Cada cuenta tiene:
   - **Código** numérico
   - **Nombre** descriptivo
   - **Naturaleza** (Deudora/Acreedora)
   - **Nivel** en la jerarquía
   - **Cuenta de mayor** (acepta movimientos) o **cuenta agregadora**

### Crear una cuenta
1. Haga clic en **Nueva Cuenta**
2. Seleccione la **cuenta padre**
3. Ingrese código, nombre y naturaleza
4. Marque "Acepta datos" si será cuenta de movimiento
5. Guarde

## Partidas Contables

### Registrar una partida

1. Vaya a **Contabilidad > Partidas Contables**
2. Haga clic en **Nueva Partida**
3. Seleccione **fecha** y **tipo de partida** (apertura, operaciones, ajuste, cierre)
4. Ingrese el **concepto** o descripción
5. Agregue los movimientos (cargos y abonos):
   - Seleccione la **cuenta**
   - Ingrese el **monto del cargo** o **abono**
   - El sistema verifica que cargos = abonos
6. Guarde la partida

**Regla fundamental:** La suma de cargos debe ser igual a la suma de abonos.

## Cierre Anual

1. Complete todas las partidas del período
2. Vaya a **Contabilidad > Cierre Anual**
3. Revise los saldos finales
4. Confirme el cierre
5. El sistema genera automáticamente la partida de cierre
6. Las cuentas de resultado se liquidan contra ganancias/pérdidas

## Apertura de Ejercicio

1. Vaya a **Contabilidad > Apertura de Ejercicio**
2. El sistema carga los saldos iniciales del cierre anterior
3. Confirme la apertura
4. Las cuentas de balance (activo, pasivo, capital) mantienen su saldo

## Ajustes

Configure parámetros contables como:
- Tipo de cambio
- Cuentas por defecto para operaciones
- Períodos contables
