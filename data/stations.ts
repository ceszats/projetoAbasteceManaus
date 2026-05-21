export type FuelType = 'gasolina' | 'aditivada' | 'etanol' | 'diesel' | 'gnv';

export interface FuelPrice {
  type: FuelType;
  price: number;
  updatedAt: Date;
  confirmations: number;
}

export type PriceConfidence = 'confirmed' | 'recent' | 'outdated';

export interface StationReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: Date;
}

export interface PriceHistory {
  date: Date;
  price: number;
}

export interface Station {
  id: string;
  name: string;
  brand: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  prices: FuelPrice[];
  reviews: StationReview[];
  priceHistory: { [key in FuelType]?: PriceHistory[] };
  amenities: string[];
  isFavorite?: boolean;
  distance?: number; // km, calculado dinamicamente
}

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const MOCK_PRICE_AGES_HOURS = [2, 5, 9, 14, 20, 28, 36, 44, 54, 72];

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const MANAUS_NEIGHBORHOOD_CENTERS = [
  { name: 'Centro', latitude: -3.1342, longitude: -60.0233 },
  { name: 'Adrianopolis', latitude: -3.1038, longitude: -60.0037 },
  { name: 'Nossa Senhora das Gracas', latitude: -3.1054, longitude: -60.0231 },
  { name: 'Aleixo', latitude: -3.0806, longitude: -59.9914 },
  { name: 'Parque 10 de Novembro', latitude: -3.0742, longitude: -60.0148 },
  { name: 'Chapada', latitude: -3.0912, longitude: -60.0237 },
  { name: 'Flores', latitude: -3.0516, longitude: -60.0044 },
  { name: 'Cidade Nova', latitude: -3.0295, longitude: -59.9956 },
  { name: 'Novo Aleixo', latitude: -3.0363, longitude: -59.9549 },
  { name: 'Tancredo Neves', latitude: -3.0551, longitude: -59.9361 },
  { name: 'Sao Jose Operario', latitude: -3.0872, longitude: -59.9465 },
  { name: 'Coroado', latitude: -3.0839, longitude: -59.9722 },
  { name: 'Japiim', latitude: -3.1181, longitude: -59.9909 },
  { name: 'Distrito Industrial', latitude: -3.1259, longitude: -59.9648 },
  { name: 'Raiz', latitude: -3.1162, longitude: -60.0028 },
  { name: 'Cachoeirinha', latitude: -3.1122, longitude: -60.0157 },
  { name: 'Sao Francisco', latitude: -3.1027, longitude: -60.0116 },
  { name: 'Petropolis', latitude: -3.1011, longitude: -59.9983 },
  { name: 'Educandos', latitude: -3.1374, longitude: -60.0141 },
  { name: 'Armando Mendes', latitude: -3.0977, longitude: -59.9309 },
  { name: 'Jorge Teixeira', latitude: -3.0366, longitude: -59.9294 },
  { name: 'Zumbi dos Palmares', latitude: -3.0687, longitude: -59.9394 },
  { name: 'Ponta Negra', latitude: -3.0736, longitude: -60.1021 },
  { name: 'Taruma', latitude: -3.0105, longitude: -60.0799 },
  { name: 'Taruma-Acu', latitude: -2.9656, longitude: -60.0711 },
  { name: 'Redencao', latitude: -3.0539, longitude: -60.0449 },
  { name: 'Alvorada', latitude: -3.0829, longitude: -60.0529 },
  { name: 'Dom Pedro', latitude: -3.0897, longitude: -60.0441 },
  { name: 'Compensa', latitude: -3.1079, longitude: -60.0612 },
  { name: 'Santo Agostinho', latitude: -3.0951, longitude: -60.0701 },
  { name: 'Planalto', latitude: -3.0687, longitude: -60.0657 },
  { name: 'Colonia Santo Antonio', latitude: -3.0143, longitude: -60.0572 },
  { name: 'Santa Etelvina', latitude: -2.9936, longitude: -60.0281 },
  { name: 'Lago Azul', latitude: -2.9568, longitude: -60.0218 },
  { name: 'Colonia Terra Nova', latitude: -2.9831, longitude: -60.0562 },
  { name: 'Monte das Oliveiras', latitude: -2.9902, longitude: -60.0079 },
  { name: 'Nova Cidade', latitude: -2.9948, longitude: -59.9856 },
  { name: 'Novo Israel', latitude: -3.0018, longitude: -60.0442 },
] as const;

const ADDRESS_NEIGHBORHOODS: Array<{ match: string; neighborhood: string }> = [
  { match: 'nossa sra das gracas', neighborhood: 'Nossa Senhora das Gracas' },
  { match: 'nossa senhora das gracas', neighborhood: 'Nossa Senhora das Gracas' },
  { match: 'djalma batista 535', neighborhood: 'Nossa Senhora das Gracas' },
  { match: 'avenida tancredo neves', neighborhood: 'Parque 10 de Novembro' },
  { match: 'avenida cosme ferreira', neighborhood: 'Sao Jose Operario' },
  { match: 'avenida arquiteto jose henriques bento rodrigues', neighborhood: 'Monte das Oliveiras' },
  { match: 'avenida general rodrigo otavio', neighborhood: 'Japiim' },
  { match: 'rua conde de sergimirim', neighborhood: 'Raiz' },
  { match: 'avenida autaz mirim', neighborhood: 'Sao Jose Operario' },
  { match: 'avenida torquato tapajos', neighborhood: 'Santa Etelvina' },
  { match: 'rua valerio botelho de andrade', neighborhood: 'Cachoeirinha' },
  { match: 'avenida do turismo', neighborhood: 'Taruma' },
  { match: 'avenida jacira reis', neighborhood: 'Dom Pedro' },
];

function inferStationNeighborhood(station: Station): string {
  const normalizedAddress = normalizeSearchText(station.address);
  const addressMatch = ADDRESS_NEIGHBORHOODS.find(({ match }) =>
    normalizedAddress.includes(match),
  );

  if (addressMatch) return addressMatch.neighborhood;
  if (station.neighborhood && station.neighborhood !== 'Manaus') return station.neighborhood;

  return MANAUS_NEIGHBORHOOD_CENTERS.reduce((closest, current) => {
    const currentDistance = calculateDistance(
      station.latitude,
      station.longitude,
      current.latitude,
      current.longitude,
    );
    const closestDistance = calculateDistance(
      station.latitude,
      station.longitude,
      closest.latitude,
      closest.longitude,
    );
    return currentDistance < closestDistance ? current : closest;
  }).name;
}

export function stationMatchesSearch(station: Station, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;

  return [station.name, station.brand, station.address, station.neighborhood]
    .map(normalizeSearchText)
    .some((value) => value.includes(q));
}

function getMockPriceUpdatedAt(stationIndex: number, priceIndex: number) {
  const ageIndex = (stationIndex + priceIndex * 2) % MOCK_PRICE_AGES_HOURS.length;
  return hoursAgo(MOCK_PRICE_AGES_HOURS[ageIndex]);
}

function getMockConfirmations(stationIndex: number, priceIndex: number, current: number) {
  const ageIndex = (stationIndex + priceIndex * 2) % MOCK_PRICE_AGES_HOURS.length;
  if (ageIndex <= 4) return Math.max(current, 2 + ((stationIndex + priceIndex) % 4));
  if (ageIndex <= 7) return Math.max(current, 1 + ((stationIndex + priceIndex) % 3));
  return Math.max(1, current);
}

const RAW_STATIONS: Station[] = [
  {
    "id": "osm-1366693707",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0655937,
    "longitude": -60.0020993,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.34,
        updatedAt: new Date("2026-04-09T08:29:09.145Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.64,
        updatedAt: new Date("2026-04-09T08:29:09.145Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.54,
        updatedAt: new Date("2026-04-09T04:29:09.145Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1376594634",
    "name": "Posto BR",
    "brand": "BR",
    "address": "Avenida Tancredo Neves",
    "neighborhood": "Manaus",
    "latitude": -3.07006,
    "longitude": -60.00643,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.15,
        updatedAt: new Date("2026-04-09T09:28:35.773Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.45,
        updatedAt: new Date("2026-04-09T09:28:35.773Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.35,
        updatedAt: new Date("2026-04-09T13:28:35.773Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.95,
        updatedAt: new Date("2026-04-09T09:28:35.773Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1379013679",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0815704,
    "longitude": -60.0063747,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.34,
        updatedAt: new Date("2026-04-09T15:17:10.153Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.64,
        updatedAt: new Date("2026-04-09T15:17:10.153Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.54,
        updatedAt: new Date("2026-04-09T13:17:10.153Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1390304416",
    "name": "Ipiranga",
    "brand": "Ipiranga",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.055823,
    "longitude": -59.9949201,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.44,
        updatedAt: new Date("2026-04-09T12:22:43.621Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.74,
        updatedAt: new Date("2026-04-09T12:22:43.621Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.64,
        updatedAt: new Date("2026-04-09T08:22:43.621Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6.24,
        updatedAt: new Date("2026-04-09T12:22:43.621Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1806192377",
    "name": "Posto Equador",
    "brand": "Equador",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0498827,
    "longitude": -59.9925026,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.12,
        updatedAt: new Date("2026-04-09T13:29:57.025Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.42,
        updatedAt: new Date("2026-04-09T13:29:57.025Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.32,
        updatedAt: new Date("2026-04-09T13:29:57.025Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.92,
        updatedAt: new Date("2026-04-09T13:29:57.025Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810280244",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0722783,
    "longitude": -60.0442361,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.2,
        updatedAt: new Date("2026-04-09T12:37:13.813Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.5,
        updatedAt: new Date("2026-04-09T12:37:13.813Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.4,
        updatedAt: new Date("2026-04-09T08:37:13.813Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810280246",
    "name": "Posto Shell",
    "brand": "Shell",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0714855,
    "longitude": -60.0485276,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.2,
        updatedAt: new Date("2026-04-09T12:37:13.741Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.5,
        updatedAt: new Date("2026-04-09T12:37:13.741Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.4,
        updatedAt: new Date("2026-04-09T08:37:13.741Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810286169",
    "name": "Posto Ipiranga",
    "brand": "Ipiranga",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0690292,
    "longitude": -60.0332398,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.26,
        updatedAt: new Date("2026-04-09T12:33:40.513Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.56,
        updatedAt: new Date("2026-04-09T12:33:40.513Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.46,
        updatedAt: new Date("2026-04-09T08:33:40.513Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810296562",
    "name": "Posto Shell",
    "brand": "Shell",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0890836,
    "longitude": -59.9952688,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.37,
        updatedAt: new Date("2026-04-09T12:27:26.365Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.67,
        updatedAt: new Date("2026-04-09T12:27:26.365Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.57,
        updatedAt: new Date("2026-04-09T08:27:26.365Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810299087",
    "name": "Posto 10",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1031593,
    "longitude": -59.9978875,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.39,
        updatedAt: new Date("2026-04-09T12:25:55.465Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.69,
        updatedAt: new Date("2026-04-09T12:25:55.465Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.59,
        updatedAt: new Date("2026-04-09T08:25:55.465Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810488459",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0486398,
    "longitude": -60.0755513,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.88,
        updatedAt: new Date("2026-04-09T10:32:18.073Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.18,
        updatedAt: new Date("2026-04-09T10:32:18.073Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.08,
        updatedAt: new Date("2026-04-09T06:32:18.073Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-1810638887",
    "name": "Posto Equador",
    "brand": "Equador",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0930202,
    "longitude": -60.0213975,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.59,
        updatedAt: new Date("2026-04-09T09:02:02.665Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.89,
        updatedAt: new Date("2026-04-09T09:02:02.665Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.79,
        updatedAt: new Date("2026-04-09T05:02:02.665Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2337252321",
    "name": "Posto atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1231853,
    "longitude": -60.0223457,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.32,
        updatedAt: new Date("2026-04-09T12:53:59.041Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.62,
        updatedAt: new Date("2026-04-09T12:53:59.041Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.52,
        updatedAt: new Date("2026-04-09T06:53:59.041Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2386513122",
    "name": "Posto Shell",
    "brand": "Shell",
    "address": "Avenida Cosme Ferreira",
    "neighborhood": "Manaus",
    "latitude": -3.075702,
    "longitude": -59.9527851,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.13,
        updatedAt: new Date("2026-04-09T10:17:30.205Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.43,
        updatedAt: new Date("2026-04-09T10:17:30.205Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.33,
        updatedAt: new Date("2026-04-09T06:17:30.205Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.93,
        updatedAt: new Date("2026-04-09T10:17:30.205Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2392943010",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1386897,
    "longitude": -60.0190216,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.43,
        updatedAt: new Date("2026-04-09T05:59:34.237Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.73,
        updatedAt: new Date("2026-04-09T05:59:34.237Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.63,
        updatedAt: new Date("2026-04-09T13:59:34.237Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 6.23,
        updatedAt: new Date("2026-04-09T05:59:34.237Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2394017239",
    "name": "BR",
    "brand": "BR",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1285472,
    "longitude": -60.0046554,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.97,
        updatedAt: new Date("2026-04-09T15:15:01.993Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.27,
        updatedAt: new Date("2026-04-09T15:15:01.993Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.17,
        updatedAt: new Date("2026-04-09T15:15:01.993Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2801456078",
    "name": "Posto Atem",
    "brand": "Petrobras",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -2.9654749,
    "longitude": -60.021102,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.96,
        updatedAt: new Date("2026-04-09T10:51:43.789Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.26,
        updatedAt: new Date("2026-04-09T10:51:43.789Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.16,
        updatedAt: new Date("2026-04-09T08:51:43.789Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2935830510",
    "name": "Posto BR",
    "brand": "BR",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1039039,
    "longitude": -60.0568189,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.51,
        updatedAt: new Date("2026-04-09T07:07:04.237Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.81,
        updatedAt: new Date("2026-04-09T07:07:04.237Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.71,
        updatedAt: new Date("2026-04-09T09:07:04.237Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2940885213",
    "name": "Posto Caburé Equador",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0562702,
    "longitude": -59.9568547,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.85,
        updatedAt: new Date("2026-04-09T06:34:14.929Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.15,
        updatedAt: new Date("2026-04-09T06:34:14.929Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.05,
        updatedAt: new Date("2026-04-09T06:34:14.929Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-2944307007",
    "name": "Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.074524,
    "longitude": -59.9497532,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.47,
        updatedAt: new Date("2026-04-09T12:21:10.345Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.77,
        updatedAt: new Date("2026-04-09T12:21:10.345Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.67,
        updatedAt: new Date("2026-04-09T08:21:10.345Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6.27,
        updatedAt: new Date("2026-04-09T12:21:10.345Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-3001098387",
    "name": "Posto BR",
    "brand": "Petrobras",
    "address": "Avenida Arquiteto José Henriques Bento Rodrigues",
    "neighborhood": "Manaus",
    "latitude": -2.9996595,
    "longitude": -59.9983175,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.38,
        updatedAt: new Date("2026-04-09T14:26:20.665Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.68,
        updatedAt: new Date("2026-04-09T14:26:20.665Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.58,
        updatedAt: new Date("2026-04-09T04:26:20.665Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-3010295446",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1144784,
    "longitude": -60.0157918,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.35,
        updatedAt: new Date("2026-04-09T12:28:06.541Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.65,
        updatedAt: new Date("2026-04-09T12:28:06.541Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.55,
        updatedAt: new Date("2026-04-09T08:28:06.541Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-3016908916",
    "name": "Atem",
    "brand": "Atem",
    "address": "Avenida General Rodrigo Otávio",
    "neighborhood": "Manaus",
    "latitude": -3.1373509,
    "longitude": -59.9890975,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.09,
        updatedAt: new Date("2026-04-09T06:20:01.621Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.39,
        updatedAt: new Date("2026-04-09T06:20:01.621Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.29,
        updatedAt: new Date("2026-04-09T14:20:01.621Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.89,
        updatedAt: new Date("2026-04-09T06:20:01.621Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4040668142",
    "name": "Posto BR",
    "brand": "BR",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0901754,
    "longitude": -60.0268484,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.08,
        updatedAt: new Date("2026-04-09T08:44:29.485Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.38,
        updatedAt: new Date("2026-04-09T08:44:29.485Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.28,
        updatedAt: new Date("2026-04-09T12:44:29.485Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4045602578",
    "name": "Posto Shell",
    "brand": "Shell",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0896128,
    "longitude": -60.0239393,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.83,
        updatedAt: new Date("2026-04-09T09:23:49.789Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.13,
        updatedAt: new Date("2026-04-09T09:23:49.789Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.03,
        updatedAt: new Date("2026-04-09T11:23:49.789Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4063867945",
    "name": "Posto Petrobras",
    "brand": "BR",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0566993,
    "longitude": -60.0832062,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.08,
        updatedAt: new Date("2026-04-09T06:44:36.577Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.38,
        updatedAt: new Date("2026-04-09T06:44:36.577Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.28,
        updatedAt: new Date("2026-04-09T08:44:36.577Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4063886415",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -2.9839183,
    "longitude": -60.0443539,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.26,
        updatedAt: new Date("2026-04-09T06:33:31.657Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.56,
        updatedAt: new Date("2026-04-09T06:33:31.657Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.46,
        updatedAt: new Date("2026-04-09T08:33:31.657Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4095348963",
    "name": "Posto Gaspetro",
    "brand": "Gaspetro",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1209018,
    "longitude": -59.9525415,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.49,
        updatedAt: new Date("2026-04-09T11:55:59.929Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.79,
        updatedAt: new Date("2026-04-09T11:55:59.929Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.69,
        updatedAt: new Date("2026-04-09T05:55:59.929Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 6.29,
        updatedAt: new Date("2026-04-09T11:55:59.929Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4095368003",
    "name": "Posto Gaspetro",
    "brand": "Gaspetro",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1123403,
    "longitude": -59.9668834,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.88,
        updatedAt: new Date("2026-04-09T11:44:34.489Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.18,
        updatedAt: new Date("2026-04-09T11:44:34.489Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.08,
        updatedAt: new Date("2026-04-09T05:44:34.489Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.68,
        updatedAt: new Date("2026-04-09T11:44:34.489Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4147203389",
    "name": "Posto BR",
    "brand": "Petrobras",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.121619,
    "longitude": -60.0075665,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.83,
        updatedAt: new Date("2026-04-09T13:23:20.593Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.13,
        updatedAt: new Date("2026-04-09T13:23:20.593Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.03,
        updatedAt: new Date("2026-04-09T15:23:20.593Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4167701342",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Rua Conde de Sergimirim",
    "neighborhood": "Manaus",
    "latitude": -3.045068,
    "longitude": -59.9900112,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.01,
        updatedAt: new Date("2026-04-09T08:24:34.285Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.31,
        updatedAt: new Date("2026-04-09T08:24:34.285Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.21,
        updatedAt: new Date("2026-04-09T14:24:34.285Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.81,
        updatedAt: new Date("2026-04-09T08:24:34.285Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4167960227",
    "name": "Posto Atem",
    "brand": "atem",
    "address": "Avenida Autaz Mirim",
    "neighborhood": "Manaus",
    "latitude": -3.0567002,
    "longitude": -59.9479685,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.2,
        updatedAt: new Date("2026-04-09T05:49:14.425Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.5,
        updatedAt: new Date("2026-04-09T05:49:14.425Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.4,
        updatedAt: new Date("2026-04-09T11:49:14.425Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6,
        updatedAt: new Date("2026-04-09T05:49:14.425Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4167974189",
    "name": "Posto Atem",
    "brand": "atem",
    "address": "Avenida Autaz Mirim",
    "neighborhood": "Manaus",
    "latitude": -3.0590062,
    "longitude": -59.9490344,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.34,
        updatedAt: new Date("2026-04-09T05:40:51.793Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.64,
        updatedAt: new Date("2026-04-09T05:40:51.793Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.54,
        updatedAt: new Date("2026-04-09T11:40:51.793Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6.14,
        updatedAt: new Date("2026-04-09T05:40:51.793Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4697616826",
    "name": "Posto Equatorial",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0231111,
    "longitude": -60.0576939,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.97,
        updatedAt: new Date("2026-04-09T09:15:16.861Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.27,
        updatedAt: new Date("2026-04-09T09:15:16.861Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.17,
        updatedAt: new Date("2026-04-09T07:15:16.861Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-4966123568",
    "name": "Posto Ipiranga",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0865621,
    "longitude": -59.9285927,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.24,
        updatedAt: new Date("2026-04-09T14:11:14.149Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.54,
        updatedAt: new Date("2026-04-09T14:11:14.149Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.44,
        updatedAt: new Date("2026-04-09T10:11:14.149Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 6.04,
        updatedAt: new Date("2026-04-09T14:11:14.149Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5049019189",
    "name": "Posto Atem",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0142164,
    "longitude": -60.0595617,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.39,
        updatedAt: new Date("2026-04-09T15:13:51.793Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.69,
        updatedAt: new Date("2026-04-09T15:13:51.793Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.59,
        updatedAt: new Date("2026-04-09T09:13:51.793Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5064009617",
    "name": "Posto Atem",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0666709,
    "longitude": -59.9648702,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.9,
        updatedAt: new Date("2026-04-09T15:19:36.385Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.2,
        updatedAt: new Date("2026-04-09T15:19:36.385Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.1,
        updatedAt: new Date("2026-04-09T15:19:36.385Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5277470263",
    "name": "Auto Posto DE",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -2.9756566,
    "longitude": -60.0153759,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.1,
        updatedAt: new Date("2026-04-09T10:43:13.129Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.4,
        updatedAt: new Date("2026-04-09T10:43:13.129Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.3,
        updatedAt: new Date("2026-04-09T04:43:13.129Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5377841223",
    "name": "Posto BR",
    "brand": "Posto BR",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0801677,
    "longitude": -60.0075671,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.81,
        updatedAt: new Date("2026-04-09T07:00:38.569Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.11,
        updatedAt: new Date("2026-04-09T07:00:38.569Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.01,
        updatedAt: new Date("2026-04-09T09:00:38.569Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5378128111",
    "name": "Posto Equador",
    "brand": "Equador",
    "address": "Avenida Torquato Tapajós",
    "neighborhood": "Manaus",
    "latitude": -2.991568,
    "longitude": -60.0281435,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.28,
        updatedAt: new Date("2026-04-09T14:08:30.601Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.58,
        updatedAt: new Date("2026-04-09T14:08:30.601Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.48,
        updatedAt: new Date("2026-04-09T06:08:30.601Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 6.08,
        updatedAt: new Date("2026-04-09T14:08:30.601Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5401104022",
    "name": "Equador",
    "brand": "Equador",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0053294,
    "longitude": -60.0390317,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.44,
        updatedAt: new Date("2026-04-09T14:22:57.805Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.74,
        updatedAt: new Date("2026-04-09T14:22:57.805Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.64,
        updatedAt: new Date("2026-04-09T04:22:57.805Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6.24,
        updatedAt: new Date("2026-04-09T14:22:57.805Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5401108676",
    "name": "Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0012074,
    "longitude": -60.0435258,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.49,
        updatedAt: new Date("2026-04-09T14:20:10.261Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.79,
        updatedAt: new Date("2026-04-09T14:20:10.261Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.69,
        updatedAt: new Date("2026-04-09T04:20:10.261Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6.29,
        updatedAt: new Date("2026-04-09T14:20:10.261Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-5827540487",
    "name": "Posto Ipiranga",
    "brand": "Ipiranga",
    "address": "Rua Valério Botelho de Andrade",
    "neighborhood": "Manaus",
    "latitude": -3.1110438,
    "longitude": -60.0067058,
    "prices": [
      {
        "type": "gasolina",
        "price": 6,
        updatedAt: new Date("2026-04-09T10:01:05.065Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.3,
        updatedAt: new Date("2026-04-09T10:01:05.065Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.2,
        updatedAt: new Date("2026-04-09T12:01:05.065Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 5.8,
        updatedAt: new Date("2026-04-09T10:01:05.065Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-9561297602",
    "name": "Posto Equador",
    "brand": "Equador Energia",
    "address": "Avenida do Turismo",
    "neighborhood": "Manaus",
    "latitude": -3.0258837,
    "longitude": -60.0577082,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.98,
        updatedAt: new Date("2026-04-09T12:26:48.925Z"),
        "confirmations": 3
      },
      {
        "type": "aditivada",
        "price": 6.28,
        updatedAt: new Date("2026-04-09T12:26:48.925Z"),
        "confirmations": 3
      },
      {
        "type": "etanol",
        "price": 4.18,
        updatedAt: new Date("2026-04-09T06:26:48.925Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-9570801171",
    "name": "BR",
    "brand": "BR",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0866629,
    "longitude": -60.0043707,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.81,
        updatedAt: new Date("2026-04-09T07:24:40.441Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.11,
        updatedAt: new Date("2026-04-09T07:24:40.441Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.01,
        updatedAt: new Date("2026-04-09T07:24:40.441Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-10108416274",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -2.983434,
    "longitude": -60.0544266,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.96,
        updatedAt: new Date("2026-04-09T11:15:36.733Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.26,
        updatedAt: new Date("2026-04-09T11:15:36.733Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.16,
        updatedAt: new Date("2026-04-09T07:15:36.733Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-10976574142",
    "name": "Atem",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0838728,
    "longitude": -60.0017661,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.94,
        updatedAt: new Date("2026-04-09T09:40:53.485Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.24,
        updatedAt: new Date("2026-04-09T09:40:53.485Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.14,
        updatedAt: new Date("2026-04-09T13:40:53.485Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.74,
        updatedAt: new Date("2026-04-09T09:40:53.485Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-10976574986",
    "name": "Atem",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0856944,
    "longitude": -59.9896225,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.95,
        updatedAt: new Date("2026-04-09T09:40:23.101Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.25,
        updatedAt: new Date("2026-04-09T09:40:23.101Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.15,
        updatedAt: new Date("2026-04-09T13:40:23.101Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.75,
        updatedAt: new Date("2026-04-09T09:40:23.101Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-10976577525",
    "name": "Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0910355,
    "longitude": -59.9922651,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.98,
        updatedAt: new Date("2026-04-09T09:38:51.697Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.28,
        updatedAt: new Date("2026-04-09T09:38:51.697Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.18,
        updatedAt: new Date("2026-04-09T13:38:51.697Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.78,
        updatedAt: new Date("2026-04-09T09:38:51.697Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-10976594393",
    "name": "Atem",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0867473,
    "longitude": -60.0119691,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.14,
        updatedAt: new Date("2026-04-09T09:28:44.449Z"),
        "confirmations": 1
      },
      {
        "type": "aditivada",
        "price": 6.44,
        updatedAt: new Date("2026-04-09T09:28:44.449Z"),
        "confirmations": 1
      },
      {
        "type": "etanol",
        "price": 4.34,
        updatedAt: new Date("2026-04-09T13:28:44.449Z"),
        "confirmations": 2
      },
      {
        "type": "diesel",
        "price": 5.94,
        updatedAt: new Date("2026-04-09T09:28:44.449Z"),
        "confirmations": 2
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-11362818636",
    "name": "Posto Ipitanga",
    "brand": "Independente",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.0733154,
    "longitude": -59.9377267,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.99,
        updatedAt: new Date("2026-04-09T07:14:11.701Z"),
        "confirmations": 4
      },
      {
        "type": "aditivada",
        "price": 6.29,
        updatedAt: new Date("2026-04-09T07:14:11.701Z"),
        "confirmations": 4
      },
      {
        "type": "etanol",
        "price": 4.19,
        updatedAt: new Date("2026-04-09T15:14:11.701Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-11655978308",
    "name": "Posto Atem",
    "brand": "Atem",
    "address": "Avenida Jacira Reis",
    "neighborhood": "Manaus",
    "latitude": -3.0955211,
    "longitude": -60.0422922,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.38,
        updatedAt: new Date("2026-04-09T05:38:23.509Z"),
        "confirmations": 5
      },
      {
        "type": "aditivada",
        "price": 6.68,
        updatedAt: new Date("2026-04-09T05:38:23.509Z"),
        "confirmations": 5
      },
      {
        "type": "etanol",
        "price": 4.58,
        updatedAt: new Date("2026-04-09T11:38:23.509Z"),
        "confirmations": 4
      },
      {
        "type": "diesel",
        "price": 6.18,
        updatedAt: new Date("2026-04-09T05:38:23.509Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
  {
    "id": "osm-12407613071",
    "name": "Atem",
    "brand": "Atem",
    "address": "Endereço não cadastrado",
    "neighborhood": "Manaus",
    "latitude": -3.1066385,
    "longitude": -60.0233734,
    "prices": [
      {
        "type": "gasolina",
        "price": 5.93,
        updatedAt: new Date("2026-04-09T09:17:32.041Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.23,
        updatedAt: new Date("2026-04-09T09:17:32.041Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.13,
        updatedAt: new Date("2026-04-09T07:17:32.041Z"),
        "confirmations": 1
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  },
   {
    "id": "osm-1366693708",
    "name": "Posto Petrobras Djalma ",
    "brand": "BR",
    "address": "Av.Djalma Batista,535 - Nossa Sra. das Graças, Manaus - AM, 69053-355",
    "neighborhood": "Nossa Senhora das Gracas",
    "latitude": -3.1053934 ,
    "longitude": -60.0230559,
    "prices": [
      {
        "type": "gasolina",
        "price": 6.34,
        updatedAt: new Date("2026-04-09T08:29:09.145Z"),
        "confirmations": 2
      },
      {
        "type": "aditivada",
        "price": 6.64,
        updatedAt: new Date("2026-04-09T08:29:09.145Z"),
        "confirmations": 2
      },
      {
        "type": "etanol",
        "price": 4.54,
        updatedAt: new Date("2026-04-09T04:29:09.145Z"),
        "confirmations": 3
      }
    ],
    "reviews": [],
    "priceHistory": {
      "gasolina": []
    },
    "amenities": [
      "Conveniência"
    ]
  }
];

export const STATIONS: Station[] = RAW_STATIONS.map((station, stationIndex) => ({
  ...station,
  neighborhood: inferStationNeighborhood(station),
  prices: station.prices.map((price, priceIndex) => ({
    ...price,
    updatedAt: getMockPriceUpdatedAt(stationIndex, priceIndex),
    confirmations: getMockConfirmations(stationIndex, priceIndex, price.confirmations),
  })),
}));

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasolina: 'Gasolina',
  aditivada: 'Aditivada',
  etanol: 'Etanol',
  diesel: 'Diesel',
  gnv: 'GNV',
};

export const FUEL_TYPE_ICONS: Record<FuelType, string> = {
  gasolina: '⛽',
  aditivada: '✨',
  etanol: '🌿',
  diesel: '🚛',
  gnv: '💨',
};

export function getPriceCategory(price: number): 'cheap' | 'medium' | 'expensive' {
  if (price <= 6.05) return 'cheap';
  if (price <= 6.30) return 'medium';
  return 'expensive';
}

export function getPriceCategoryColor(category: 'cheap' | 'medium' | 'expensive', scheme: 'light' | 'dark' = 'light'): string {
  const colors = {
    cheap: scheme === 'light' ? '#15803D' : '#22C55E',
    medium: scheme === 'light' ? '#F59E0B' : '#FBBF24',
    expensive: scheme === 'light' ? '#DC2626' : '#F87171',
  };
  return colors[category];
}

export function isOutdated(date: Date): boolean {
  const hoursOld = (new Date().getTime() - date.getTime()) / (1000 * 60 * 60);
  return hoursOld > 48;
}

export function getPriceConfidence(price: FuelPrice): PriceConfidence {
  const hoursOld = (new Date().getTime() - price.updatedAt.getTime()) / (1000 * 60 * 60);
  if (hoursOld <= 24 && price.confirmations >= 2) return 'confirmed';
  if (hoursOld <= 48) return 'recent';
  return 'outdated';
}

export function formatTimeAgo(date: Date): string {
  const minutes = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60));
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function getLowestPrice(station: Station, fuelType: FuelType = 'gasolina'): FuelPrice | undefined {
  return station.prices.find(p => p.type === fuelType);
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Localização central de Manaus para referência
export const MANAUS_CENTER = {
  latitude: -3.1019,
  longitude: -60.0250,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
