/**
 * Script de correção: fix-prices.js
 * 
 * Problemas corrigidos:
 * 1. station/[id].tsx: seção de preços usa dbContributions via livePriceMap ao invés do array estático
 * 2. routers.ts: remove validação stationIds hardcoded de contributions.add
 */
const fs = require('fs');

// ─────────────────────────────────────────────
// FIX 1: server/routers.ts
// Remover a restrição de stationIds hardcoded
// ─────────────────────────────────────────────
let routers = fs.readFileSync('server/routers.ts', 'utf8');

// Remove a linha de stationIds e a linha de priceSchema que dependia do import de STATIONS
// e o import de STATIONS
routers = routers.replace(
  /^import \{ STATIONS \} from "\.\.\/data\/stations";\n\nconst stationIds = new Set\(STATIONS\.map\(\(station\) => station\.id\)\);\n/m,
  ''
);

// Remove refine de stationId
routers = routers.replace(
  `stationId: z.string().refine((id) => stationIds.has(id), "Posto nao encontrado"),`,
  `stationId: z.string().min(1, "stationId obrigatório"),`
);

fs.writeFileSync('server/routers.ts', routers);
console.log('[Fix 1] server/routers.ts corrigido ✓');

// ─────────────────────────────────────────────
// FIX 2: app/station/[id].tsx  
// Calcular livePriceMap por combustível usando dbContributions
// e substituir a renderização de preços
// ─────────────────────────────────────────────
let station = fs.readFileSync('app/station/[id].tsx', 'utf8');

// Substitui o bloco de cálculo de preços por um que considera todos os fuelTypes
const OLD_PRICE_CALC = `  // Motor de preços para o combustível selecionado
  const currentFuelPrices = useMemo(() => {
    if (!dbContributions) return [];
    return dbContributions.filter(c => c.fuelType === selectedFuel);
  }, [dbContributions, selectedFuel]);

  const priceStats = usePriceEngine(currentFuelPrices, selectedFuel);`;

const NEW_PRICE_CALC = `  // Motor de preços: calcula mediana por tipo de combustível usando contribuições do banco
  const FUEL_TYPES_ALL: FuelType[] = ['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv'];

  const livePriceMap = useMemo(() => {
    const map: Record<string, { median: number; count: number; lastAt: Date }> = {};
    if (!dbContributions || dbContributions.length === 0) return map;

    for (const ft of FUEL_TYPES_ALL) {
      const items = dbContributions.filter(c => c.fuelType === ft);
      if (items.length === 0) continue;

      const recent24h = items.filter(c =>
        new Date(c.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      const use = recent24h.length > 0 ? recent24h : items;
      const sorted = [...use].map(c => c.price).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
      const lastAt = use.reduce((latest, c) =>
        new Date(c.createdAt) > new Date(latest.createdAt) ? c : latest
      ).createdAt;

      map[ft] = { median: parseFloat(med.toFixed(2)), count: use.length, lastAt: new Date(lastAt) };
    }
    return map;
  }, [dbContributions]);

  const currentFuelPrices = useMemo(() => {
    if (!dbContributions) return [];
    return dbContributions.filter(c => c.fuelType === selectedFuel);
  }, [dbContributions, selectedFuel]);

  const priceStats = usePriceEngine(currentFuelPrices, selectedFuel);

  // Mescla preços do DB com os estáticos: DB tem prioridade quando existir
  const displayPrices = useMemo(() => {
    const live = livePriceMap;
    const staticPrices = station?.prices ?? [];

    // Para cada fuelType que tem dado ao vivo, cria entrada
    const result: { type: FuelType; price: number; updatedAt: Date; confirmations: number; isLive: boolean }[] = [];

    for (const ft of FUEL_TYPES_ALL) {
      if (live[ft]) {
        result.push({
          type: ft as FuelType,
          price: live[ft].median,
          updatedAt: live[ft].lastAt,
          confirmations: live[ft].count,
          isLive: true,
        });
      } else {
        const staticP = staticPrices.find(p => p.type === ft);
        if (staticP) {
          result.push({ ...staticP, isLive: false });
        }
      }
    }
    return result;
  }, [livePriceMap, station]);`;

if (station.includes(OLD_PRICE_CALC)) {
  station = station.replace(OLD_PRICE_CALC, NEW_PRICE_CALC);
  console.log('[Fix 2a] Cálculo de preços por fuelType injetado ✓');
} else {
  console.error('[Fix 2a] FALHOU: bloco alvo não encontrado!');
  process.exit(1);
}

// Substitui a seção de renderização de preços para usar displayPrices ao invés de station.prices
const OLD_PRICES_RENDER = `        {/* Preços */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preços</Text>
        <View style={[styles.pricesCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
          {station.prices.map((p, i) => {
            const cat = getPriceCategory(p.price);
            const pc = getPriceCategoryColor(cat);
            const outdated = isOutdated(p.updatedAt);
            const isSelected = p.type === selectedFuel;
            return (
              <Pressable
                key={p.type}
                onPress={() => setSelectedFuel(p.type)}
                style={({ pressed }) => [
                  styles.priceRow,
                  i < station.prices.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                  isSelected && { backgroundColor: colors.primary + '10' },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.fuelIcon}>{FUEL_TYPE_ICONS[p.type]}</Text>
                <Text style={[styles.fuelName, { color: colors.foreground }]}>{FUEL_TYPE_LABELS[p.type]}</Text>
                <View style={styles.priceRight}>
                  {outdated && (
                    <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.warning} />
                  )}
                  <Text style={[styles.priceTime, { color: outdated ? colors.warning : colors.muted }]}>
                    {formatTimeAgo(p.updatedAt)}
                  </Text>
                  <View style={[styles.priceBadge, { backgroundColor: pc + '20' }]}>
                    <Text style={[styles.priceValue, { color: pc }]}>R$ {p.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <IconSymbol name="person.2.fill" size={11} color={colors.muted} />
                    <Text style={[styles.confirmText, { color: colors.muted }]}>{p.confirmations}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>`;

const NEW_PRICES_RENDER = `        {/* Preços */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preços</Text>
        <View style={[styles.pricesCard, { backgroundColor: colors.surface, borderRadius: tokens.radius.md, ...tokens.shadows.soft }]}>
          {displayPrices.length === 0 ? (
            <Text style={[styles.priceTime, { color: colors.muted, padding: 16, textAlign: 'center' }]}>
              Sem preços disponíveis — contribua reportando!
            </Text>
          ) : displayPrices.map((p, i) => {
            const cat = getPriceCategory(p.price);
            const pc = getPriceCategoryColor(cat);
            const outdated = isOutdated(p.updatedAt);
            const isSelected = p.type === selectedFuel;
            return (
              <Pressable
                key={p.type}
                onPress={() => setSelectedFuel(p.type)}
                style={({ pressed }) => [
                  styles.priceRow,
                  i < displayPrices.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                  isSelected && { backgroundColor: colors.primary + '10' },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.fuelIcon}>{FUEL_TYPE_ICONS[p.type]}</Text>
                <Text style={[styles.fuelName, { color: colors.foreground }]}>{FUEL_TYPE_LABELS[p.type]}</Text>
                <View style={styles.priceRight}>
                  {p.isLive ? (
                    <View style={{ backgroundColor: colors.success + '20', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, color: colors.success, fontWeight: '700' }}>AO VIVO</Text>
                    </View>
                  ) : outdated && (
                    <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.warning} />
                  )}
                  <Text style={[styles.priceTime, { color: outdated && !p.isLive ? colors.warning : colors.muted }]}>
                    {formatTimeAgo(p.updatedAt)}
                  </Text>
                  <View style={[styles.priceBadge, { backgroundColor: pc + '20' }]}>
                    <Text style={[styles.priceValue, { color: pc }]}>R$ {p.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <IconSymbol name="person.2.fill" size={11} color={colors.muted} />
                    <Text style={[styles.confirmText, { color: colors.muted }]}>{p.confirmations}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>`;

if (station.includes(OLD_PRICES_RENDER)) {
  station = station.replace(OLD_PRICES_RENDER, NEW_PRICES_RENDER);
  console.log('[Fix 2b] Renderização de preços substituída ✓');
} else {
  console.error('[Fix 2b] FALHOU: renderização não encontrada!');
  process.exit(1);
}

// Fix 3: selectedPrice e priceCategory devem usar displayPrices também
const OLD_SELECTED = `  const selectedPrice = station.prices.find(p => p.type === selectedFuel);
  const priceCategory = selectedPrice ? getPriceCategory(selectedPrice.price) : 'medium';
  const priceColor = getPriceCategoryColor(priceCategory);
  const selectedConfidence = selectedPrice ? getPriceConfidence(selectedPrice) : null;`;

// Só pode ser feito após o station null check mas antes do render, 
// mas displayPrices é computado com useMemo que depende de station - então vamos mover para após o useMemo
// Ao invés de substituir, apenas corrigir o selectedPrice para usar displayPrices
const NEW_SELECTED = `  const selectedPrice = displayPrices.find(p => p.type === selectedFuel) ?? station.prices.find(p => p.type === selectedFuel);
  const priceCategory = selectedPrice ? getPriceCategory(selectedPrice.price) : 'medium';
  const priceColor = getPriceCategoryColor(priceCategory);
  const selectedConfidence = selectedPrice && !selectedPrice.isLive ? getPriceConfidence(selectedPrice) : null;`;

if (station.includes(OLD_SELECTED)) {
  station = station.replace(OLD_SELECTED, NEW_SELECTED);
  console.log('[Fix 2c] selectedPrice corrigido para usar displayPrices ✓');
} else {
  console.error('[Fix 2c] selectedPrice não encontrado - verifique manualmente');
}

fs.writeFileSync('app/station/[id].tsx', station);
console.log('[Fix 2] app/station/[id].tsx salvo ✓');
console.log('\n✅ Todos os fixes aplicados!');
