const fs = require('fs');
const file = "app/station/[id].tsx";
let content = fs.readFileSync(file, 'utf8');

// 1. Adiciona import do RouteModal e remove Linking (não mais necessário no topo)
content = content.replace(
  "import { PriceConfirmBanner } from '@/components/fuel/PriceConfirmBanner';",
  "import { PriceConfirmBanner } from '@/components/fuel/PriceConfirmBanner';\nimport { RouteModal } from '@/components/navigation/RouteModal';"
);

// Remove Linking do import de react-native
content = content.replace(
  "  Linking,\n  Platform,",
  "  Platform,"
);

// 2. Muda handleDirections para abrir modal
const oldHandleDirections = content.match(/const handleDirections = \(\) => \{[\s\S]*?\};(\r?\n)/)?.[0];
if (oldHandleDirections) {
  content = content.replace(oldHandleDirections, "const handleDirections = () => setShowRoute(true);\n");
}

// 3. Adiciona RouteModal antes do </View> final da tela
const closeMainView = '    </View>\n  );\n}';
const routeModalJsx = `    </View>

      {/* Modal de navegação in-app */}
      {station && (
        <RouteModal
          visible={showRoute}
          onClose={() => setShowRoute(false)}
          stationName={station.name}
          stationBrand={station.brand}
          destination={{ latitude: station.latitude, longitude: station.longitude }}
          userLocation={state.userLocation}
        />
      )}
    </View>
  );
}`;

// Encontra o último </View> antes do );
const lastIdx = content.lastIndexOf('    </View>\n  );\n}');
if (lastIdx !== -1) {
  content = content.substring(0, lastIdx) + routeModalJsx + content.substring(lastIdx + closeMainView.length);
}

fs.writeFileSync(file, content);
console.log('Feito!');
