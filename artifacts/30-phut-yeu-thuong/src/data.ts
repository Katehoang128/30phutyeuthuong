export type Ingredient = [string, number, string?];
export type Dish = {
  name: string;
  time: number;
  veg?: boolean;
  costTier?: 'thap' | 'vua' | 'cao';
  method?: string;
  tags?: string[];
  proteinGroup?: 'fish' | 'seafood' | 'pork' | 'chicken' | 'beef' | 'egg' | 'soy' | 'plant';
  preparation?: 'steam' | 'boil' | 'braise' | 'stirfry' | 'soup' | 'grill' | 'raw' | 'porridge';
  allergens?: string[];
  ing: Ingredient[];
  type?: 'sang' | 'dam' | 'rau' | 'canh';
  // Multi-cuisine tag: undefined = Truyền Thống (the base dish bank). Used by the Cuisine Filter to
  // softly boost matching dishes in poolAllowed's sort, never as a hard exclude (so a pool never goes
  // empty if a style has no dish for a given category yet).
  cuisineStyle?: 'dac-san-3-mien' | 'han-nhat' | 'au-my';
};

const inferProteinGroup = (name: string, ing: Ingredient[]): NonNullable<Dish['proteinGroup']> => {
  const text = `${name} ${ing.map(([ingredient]) => ingredient).join(' ')}`.toLowerCase();
  if (/(tôm|cua|mực|hải sản)/.test(text)) return 'seafood';
  if (/(cá|cá hồi)/.test(text)) return 'fish';
  if (/bò/.test(text)) return 'beef';
  if (/(heo|thịt bằm|thịt viên|chả lụa)/.test(text)) return 'pork';
  // Trứng checked before gà: "Trứng gà" contains the substring "gà", so pure egg dishes were
  // previously misclassified as chicken whenever their only meat-like ingredient was "Trứng gà".
  if (/trứng/.test(text)) return 'egg';
  if (/(gà|ức gà|đùi gà)/.test(text)) return 'chicken';
  if (/(đậu hũ|đậu nành)/.test(text)) return 'soy';
  return 'plant';
};

const inferPreparation = (method?: string): NonNullable<Dish['preparation']> => {
  if (method === 'braise') return 'braise';
  if (method === 'stirfry' || method === 'panfry' || method === 'friedegg') return 'stirfry';
  if (method === 'soup' || method === 'oatsoup' || method === 'phobun') return 'soup';
  if (method === 'porridge') return 'porridge';
  if (method === 'airfry') return 'grill';
  if (method === 'nocook' || method === 'soak' || method === 'readymade') return 'raw';
  if (method === 'steam' || method === 'boilsteam' || method === 'xoi') return 'steam';
  return 'boil';
};

const inferAllergens = (name: string, ing: Ingredient[]) => {
  const text = `${name} ${ing.map(([ingredient]) => ingredient).join(' ')}`.toLowerCase();
  return [
    ...(/tôm/.test(text) ? ['tôm'] : []),
    ...(/(cua|mực|hải sản)/.test(text) ? ['hải sản'] : []),
    ...(/trứng/.test(text) ? ['trứng'] : []),
    ...(/(đậu hũ|đậu nành)/.test(text) ? ['đậu nành'] : []),
    ...(/sữa/.test(text) ? ['sữa'] : []),
    ...(/(bánh mì|bánh cuốn)/.test(text) ? ['gluten'] : []),
  ];
};

const d = (name: string, time: number, ing: Ingredient[], extra: Partial<Dish> = {}): Dish => ({
  name,
  time,
  ing,
  proteinGroup: inferProteinGroup(name, ing),
  preparation: inferPreparation(extra.method),
  allergens: inferAllergens(name, ing),
  ...extra,
});

export const BREAKFAST: Dish[] = [
  d('Cháo trứng bí đỏ',10,[['Gạo tẻ',25],['Bí đỏ',40],['Trứng gà',.4,'quả']],{veg:true,costTier:'thap',method:'porridge',tags:['Dễ tiêu','Vitamin A']}),
  d('Cháo tôm bí đỏ',15,[['Gạo tẻ',25],['Tôm tươi',40],['Bí đỏ',30]],{costTier:'vua',method:'porridge',tags:['Đạm','Canxi']}),
  d('Cháo thịt bằm rau củ',15,[['Gạo tẻ',25],['Thịt heo xay',35],['Cà rốt',20]],{costTier:'thap',method:'porridge',tags:['Đạm','Sắt']}),
  d('Bánh mì trứng ốp la',8,[['Bánh mì',1,'ổ'],['Trứng gà',1,'quả']],{veg:true,costTier:'thap',method:'friedegg',tags:['Nhanh gọn']}),
  d('Xôi đậu xanh',10,[['Gạo nếp',60],['Đậu xanh',20]],{veg:true,costTier:'thap',method:'xoi',tags:['Năng lượng bền']}),
  d('Phở gà nhà nấu',15,[['Bánh phở',70],['Ức gà hoặc đùi gà',40],['Giá đỗ',15]],{costTier:'vua',method:'phobun',tags:['Đạm','Ấm bụng']}),
  d('Bún gạo xào rau củ',12,[['Bún gạo',70],['Cà rốt',20],['Bắp cải',20]],{veg:true,costTier:'thap',method:'stirfry',tags:['Chất xơ']}),
  d('Bánh cuốn chả lụa',6,[['Bánh cuốn',100],['Chả lụa',30]],{costTier:'vua',method:'readymade',tags:['Nhanh gọn']}),
  d('Khoai lang hấp & trứng luộc',12,[['Khoai lang',100],['Trứng gà',.5,'quả']],{veg:true,costTier:'thap',method:'boilsteam',tags:['Chất xơ','Đạm']}),
  d('Yến mạch sữa chuối',5,[['Yến mạch',30],['Chuối',50],['Sữa tươi không đường',120,'ml']],{veg:true,costTier:'vua',method:'soak',tags:['Chất xơ','Năng lượng']}),
  d('Súp bí đỏ yến mạch',12,[['Bí đỏ',50],['Yến mạch',20]],{veg:true,costTier:'thap',method:'oatsoup',tags:['Dễ tiêu']}),
  d('Bánh mì chảo trứng thịt',10,[['Bánh mì',1,'ổ'],['Trứng gà',.5,'quả'],['Thịt heo xay',20]],{costTier:'vua',method:'friedegg',tags:['Đạm','Nhanh gọn']}),
  d('Bún đậu hũ cà chua',15,[['Bún gạo',70],['Đậu hũ',40],['Cà chua',30]],{veg:true,costTier:'thap',method:'phobun',tags:['Đạm thực vật']}),
  d('Sữa tươi & trái cây tươi',3,[['Sữa tươi không đường',200,'ml'],['Chuối',60]],{veg:true,costTier:'thap',method:'nocook',tags:['Nhanh gọn']}),
  d('Cháo cá lóc rau ngót',20,[['Gạo tẻ',25],['Cá lóc hoặc cá basa',45],['Rau ngót',20]],{costTier:'vua',method:'porridge',preparation:'porridge',proteinGroup:'fish',allergens:[],tags:['Dễ tiêu','Omega-3']}),
  d('Cháo gà cà rốt',20,[['Gạo tẻ',25],['Ức gà hoặc đùi gà',45],['Cà rốt',20]],{costTier:'thap',method:'porridge',preparation:'porridge',proteinGroup:'chicken',allergens:[],tags:['Đạm nạc','Dễ tiêu']}),
  d('Cháo đậu xanh bí đỏ',18,[['Gạo tẻ',20],['Đậu xanh',20],['Bí đỏ',40]],{veg:true,costTier:'thap',method:'porridge',preparation:'porridge',proteinGroup:'plant',allergens:[],tags:['Thanh nhẹ','Chất xơ']}),
  d('Bún gạo trứng rau muống',12,[['Bún gạo',70],['Trứng gà',1,'quả'],['Rau muống hoặc rau lang',40]],{veg:true,costTier:'thap',method:'stirfry',preparation:'stirfry',proteinGroup:'egg',allergens:['trứng'],tags:['Nhanh gọn','Sắt']}),
  d('Khoai lang nghiền sữa',8,[['Khoai lang',120],['Sữa tươi không đường',80,'ml']],{veg:true,costTier:'thap',method:'boilsteam',preparation:'boil',proteinGroup:'plant',allergens:['sữa'],tags:['Dễ tiêu','Chất xơ']}),
  d('Xôi đậu xanh bí đỏ',15,[['Gạo nếp',55],['Đậu xanh',20],['Bí đỏ',30]],{veg:true,costTier:'thap',method:'xoi',preparation:'steam',proteinGroup:'plant',allergens:[],tags:['Năng lượng bền','Beta-caroten']}),
  d('Bánh mì gà xé rau cải',12,[['Bánh mì',1,'ổ'],['Ức gà hoặc đùi gà',45],['Cải thảo',25]],{costTier:'vua',method:'readymade',preparation:'raw',proteinGroup:'chicken',allergens:['gluten'],tags:['Đạm nạc','Nhanh gọn']}),
  d('Bún cá basa cà chua',18,[['Bún gạo',70],['Cá basa hoặc cá lóc phi lê',55],['Cà chua',40]],{costTier:'vua',method:'phobun',preparation:'soup',proteinGroup:'fish',allergens:[],tags:['Omega-3','Ấm bụng']}),
  d('Trứng cuộn rau củ',10,[['Trứng gà',1,'quả'],['Cà rốt',20],['Cải thìa',20]],{veg:true,costTier:'thap',method:'friedegg',preparation:'stirfry',proteinGroup:'egg',allergens:['trứng'],tags:['Đạm','Vitamin A']}),
  d('Khoai lang và trứng hấp',15,[['Khoai lang',80],['Trứng gà',1,'quả']],{veg:true,costTier:'thap',method:'boilsteam',preparation:'steam',proteinGroup:'egg',allergens:['trứng'],tags:['Chất xơ','Đạm']}),
  d('Cháo yến mạch trứng rau xanh',12,[['Yến mạch',30],['Trứng gà',1,'quả'],['Cải bó xôi',30]],{veg:true,costTier:'thap',method:'oatsoup',preparation:'porridge',proteinGroup:'egg',allergens:['trứng'],tags:['Sắt','Dễ tiêu']}),
  d('Bún gạo gà rau cải',18,[['Bún gạo',70],['Ức gà hoặc đùi gà',45],['Cải thảo',30]],{costTier:'vua',method:'phobun',preparation:'soup',proteinGroup:'chicken',allergens:[],tags:['Đạm nạc','Chất xơ']}),
];

export const DAM: Dish[] = [
  d('Cá basa/cá lóc hấp gừng hành',15,[['Cá basa hoặc cá lóc phi lê',120],['Gừng',5],['Hành lá',5]],{costTier:'vua',tags:['Omega-3','Canxi']}),
  d('Tôm hấp/luộc sả',10,[['Tôm tươi',100],['Sả',5]],{costTier:'cao',tags:['Đạm','Canxi','Kẽm']}),
  d('Trứng hấp thịt băm',15,[['Trứng gà',.5,'quả'],['Thịt heo xay',50]],{costTier:'thap',tags:['Đạm','Sắt']}),
  d('Thịt viên hấp đậu hũ',20,[['Thịt heo xay',60],['Đậu hũ',30],['Hành tím',5]],{costTier:'thap',tags:['Đạm','Canxi']}),
  d('Cá diêu hồng hấp xì dầu',15,[['Cá diêu hồng',130],['Hành lá',5],['Gừng',5]],{costTier:'vua',tags:['Omega-3','Đạm']}),
  d('Đậu hũ hấp nấm',12,[['Đậu hũ',110],['Nấm rơm hoặc nấm bào ngư',30]],{veg:true,costTier:'thap',tags:['Đạm thực vật','Dễ tiêu']}),
  d('Sườn non hấp mềm',28,[['Sườn non',100]],{costTier:'cao',tags:['Đạm','Canxi']}),
  d('Gà hấp lá chanh',25,[['Ức gà hoặc đùi gà',110],['Lá chanh',3,'lá']],{costTier:'thap',tags:['Đạm','Dễ tiêu']}),
  d('Cá hồi áp chảo ít dầu',12,[['Cá hồi',110],['Chanh',5]],{costTier:'cao',method:'panfry',tags:['Omega-3','DHA']}),
  d('Mực hấp gừng',10,[['Mực tươi',110],['Gừng',5]],{costTier:'cao',tags:['Đạm','Kẽm']}),
  d('Gan heo áp chảo (bổ sắt)',10,[['Gan heo',90]],{costTier:'thap',method:'panfry',tags:['Sắt','Vitamin A']}),
  d('Chả cá hấp',15,[['Chả cá',100]],{costTier:'vua',tags:['Đạm','Omega-3']}),
  d('Đậu hũ nhồi thịt hấp',18,[['Đậu hũ',80],['Thịt heo xay',40]],{costTier:'thap',tags:['Đạm','Canxi']}),
  d('Trứng cút hấp thịt',12,[['Trứng cút',6,'quả'],['Thịt heo xay',40]],{costTier:'thap',tags:['Đạm','Canxi']}),
  d('Chả trứng hấp tôm thịt',15,[['Tôm tươi',50],['Thịt heo xay',30],['Trứng gà',.5,'quả']],{costTier:'vua',tags:['Đạm']}),
  d('Cá lóc hấp cách thủy sả ớt',16,[['Cá lóc hoặc cá basa',120],['Sả',5]],{costTier:'vua',tags:['Omega-3','Đạm']}),
  d('Đậu hũ hấp trứng',12,[['Đậu hũ',90],['Trứng gà',.5,'quả']],{veg:true,costTier:'thap',tags:['Đạm','Canxi']}),
  d('Tôm hấp bí đỏ',15,[['Tôm tươi',90],['Bí đỏ',40]],{costTier:'vua',tags:['Đạm','Vitamin A']}),
  d('Đậu hũ sốt cà chua',12,[['Đậu hũ',150],['Cà chua',60]],{veg:true,costTier:'thap',tags:['Đạm','Chay']}),
  d('Nấm rơm kho tiêu chay',15,[['Nấm rơm hoặc nấm bào ngư',150]],{veg:true,costTier:'thap',tags:['Đạm','Chay']}),
  d('Đậu hũ chiên sả ít dầu',12,[['Đậu hũ',150],['Sả',5]],{veg:true,costTier:'thap',tags:['Đạm','Chay']}),
  d('Trứng hấp nấm',12,[['Trứng gà',2,'quả'],['Nấm rơm hoặc nấm bào ngư',50]],{veg:true,costTier:'thap',tags:['Đạm','Chay']}),
  d('Đậu hũ non sốt nấm',12,[['Đậu hũ',150],['Nấm rơm hoặc nấm bào ngư',60]],{veg:true,costTier:'thap',tags:['Đạm','Chay']}),
  d('Trứng cút kho nấm chay',15,[['Trứng cút',8,'quả'],['Nấm rơm hoặc nấm bào ngư',40]],{veg:true,costTier:'thap',tags:['Đạm','Chay']}),
  d('Ức gà nướng/chiên không dầu',20,[['Ức gà hoặc đùi gà',120]],{costTier:'vua',method:'airfry',tags:['Đạm nạc','Ít béo']}),
  d('Cá hồi nướng/chiên không dầu',18,[['Cá hồi',120]],{costTier:'cao',method:'airfry',tags:['Omega-3']}),
  d('Sườn non nướng mật ong',25,[['Sườn non',130]],{costTier:'cao',method:'airfry',tags:['Đạm','Canxi']}),
  d('Tôm nướng/chiên không dầu',12,[['Tôm tươi',100]],{costTier:'cao',method:'airfry',tags:['Đạm','Kẽm']}),
  d('Cá basa nướng giấy bạc',20,[['Cá basa hoặc cá lóc phi lê',120],['Hành tím',5]],{costTier:'vua',method:'airfry',tags:['Omega-3']}),
  d('Đậu hũ chiên không dầu giòn',12,[['Đậu hũ',150]],{veg:true,costTier:'thap',method:'airfry',tags:['Đạm thực vật','Chay']}),
  d('Gan heo nướng/chiên không dầu',15,[['Gan heo',100]],{costTier:'thap',method:'airfry',tags:['Sắt']}),
  d('Mực nướng sa tế nhẹ',12,[['Mực tươi',110]],{costTier:'cao',method:'airfry',tags:['Đạm']}),
  d('Cá basa kho gừng',22,[['Cá basa hoặc cá lóc phi lê',120],['Gừng',6]],{costTier:'vua',method:'braise',preparation:'braise',proteinGroup:'fish',allergens:[],tags:['Omega-3','Ấm bụng']}),
  d('Cá diêu hồng hấp bí xanh',20,[['Cá diêu hồng',120],['Bí xanh',50]],{costTier:'vua',method:'steam',preparation:'steam',proteinGroup:'fish',allergens:[],tags:['Dễ tiêu','Đạm']}),
  d('Tôm rim cà chua nhạt',18,[['Tôm tươi',100],['Cà chua',50]],{costTier:'cao',method:'braise',preparation:'braise',proteinGroup:'seafood',allergens:['tôm'],tags:['Đạm','Kẽm']}),
  d('Mực xào cải thìa',15,[['Mực tươi',100],['Cải thìa',80]],{costTier:'cao',method:'stirfry',preparation:'stirfry',proteinGroup:'seafood',allergens:['mực'],tags:['Đạm','Canxi']}),
  d('Thịt heo kho cà rốt',25,[['Thịt heo xay',90],['Cà rốt',60]],{costTier:'thap',method:'braise',preparation:'braise',proteinGroup:'pork',allergens:[],tags:['Đạm','Vitamin A']}),
  d('Thịt heo hấp cải thảo',20,[['Thịt heo xay',90],['Cải thảo',70]],{costTier:'thap',method:'steam',preparation:'steam',proteinGroup:'pork',allergens:[],tags:['Đạm','Dễ tiêu']}),
  d('Gà kho gừng mềm',25,[['Ức gà hoặc đùi gà',120],['Gừng',6]],{costTier:'vua',method:'braise',preparation:'braise',proteinGroup:'chicken',allergens:[],tags:['Đạm nạc','Ấm bụng']}),
  d('Gà xé trộn bắp cải',15,[['Ức gà hoặc đùi gà',100],['Bắp cải',80],['Chanh',5]],{costTier:'vua',method:'raw',preparation:'raw',proteinGroup:'chicken',allergens:[],tags:['Đạm nạc','Chất xơ']}),
  d('Đậu hũ kho nấm',18,[['Đậu hũ',140],['Nấm rơm hoặc nấm bào ngư',70]],{veg:true,costTier:'thap',method:'braise',preparation:'braise',proteinGroup:'soy',allergens:['đậu nành'],tags:['Đạm thực vật','Dễ tiêu']}),
  d('Trứng luộc sốt cà chua',15,[['Trứng gà',2,'quả'],['Cà chua',70]],{veg:true,costTier:'thap',method:'boil',preparation:'boil',proteinGroup:'egg',allergens:['trứng'],tags:['Đạm','Vitamin A']}),
  d('Cá basa hấp cải thảo',18,[['Cá basa hoặc cá lóc phi lê',120],['Cải thảo',60]],{costTier:'vua',method:'steam',preparation:'steam',proteinGroup:'fish',allergens:[],tags:['Omega-3','Dễ tiêu']}),
  d('Gà áp chảo bí xanh',18,[['Ức gà hoặc đùi gà',110],['Bí xanh',60]],{costTier:'vua',method:'panfry',preparation:'stirfry',proteinGroup:'chicken',allergens:[],tags:['Đạm nạc','Thanh mát']}),
  d('Tôm xào bông cải xanh',15,[['Tôm tươi',90],['Bông cải xanh',80]],{costTier:'cao',method:'stirfry',preparation:'stirfry',proteinGroup:'seafood',allergens:['tôm'],tags:['Đạm','Vitamin C']}),
  d('Đậu hũ hấp bí đỏ nấm',15,[['Đậu hũ',100],['Bí đỏ',50],['Nấm rơm hoặc nấm bào ngư',40]],{veg:true,costTier:'thap',method:'steam',preparation:'steam',proteinGroup:'soy',allergens:['đậu nành'],tags:['Đạm thực vật','Chất xơ']}),
  d('Trứng kho cà rốt nấm',16,[['Trứng gà',2,'quả'],['Cà rốt',40],['Nấm rơm hoặc nấm bào ngư',40]],{veg:true,costTier:'thap',method:'braise',preparation:'braise',proteinGroup:'egg',allergens:['trứng'],tags:['Đạm','Vitamin A']}),
  d('Bò xào cải thìa ít dầu',15,[['Thịt bò',100],['Cải thìa',80]],{costTier:'cao',method:'stirfry',preparation:'stirfry',proteinGroup:'beef',allergens:['thịt bò'],tags:['Đạm','Sắt']}),
  d('Bò hấp gừng sả',15,[['Thịt bò',110],['Gừng',5],['Sả',5]],{costTier:'cao',method:'steam',preparation:'steam',proteinGroup:'beef',allergens:['thịt bò'],tags:['Đạm','Sắt']}),
  d('Bò kho cà rốt mềm',30,[['Thịt bò',100],['Cà rốt',50]],{costTier:'cao',method:'braise',preparation:'braise',proteinGroup:'beef',allergens:['thịt bò'],tags:['Đạm','Sắt']}),
  d('Lòng heo luộc chấm mắm gừng',20,[['Lòng heo',100],['Gừng',5]],{costTier:'vua',method:'boil',preparation:'boil',proteinGroup:'pork',allergens:[],tags:['Đạm']}),
  d('Lòng heo xào bắp cải',18,[['Lòng heo',90],['Bắp cải',60]],{costTier:'vua',method:'stirfry',preparation:'stirfry',proteinGroup:'pork',allergens:[],tags:['Đạm']}),
  d('Gà kho sả ớt nhẹ',22,[['Ức gà hoặc đùi gà',110],['Sả',5]],{costTier:'vua',method:'braise',preparation:'braise',proteinGroup:'chicken',allergens:[],tags:['Đạm nạc','Ấm bụng']}),
  // Đặc sản 3 miền
  d('Cá bống kho tiêu',20,[['Cá bống',150],['Hành tím',5]],{costTier:'vua',method:'braise',preparation:'braise',cuisineStyle:'dac-san-3-mien',tags:['Đặc sản miền Trung','Đạm']}),
  d('Kho quẹt rau luộc',15,[['Thịt heo xay',60],['Tôm khô',15]],{costTier:'thap',method:'braise',preparation:'braise',proteinGroup:'pork',cuisineStyle:'dac-san-3-mien',tags:['Đặc sản miền Nam','Đưa cơm']}),
  // Hàn Quốc & Nhật Bản
  d('Cá hồi sốt Teriyaki',15,[['Cá hồi',120],['Sốt Teriyaki',15]],{costTier:'cao',method:'panfry',preparation:'stirfry',cuisineStyle:'han-nhat',tags:['Nhật Bản','Omega-3']}),
  d('Cá thu sốt Teriyaki',15,[['Cá thu',120],['Sốt Teriyaki',15]],{costTier:'vua',method:'panfry',preparation:'stirfry',cuisineStyle:'han-nhat',tags:['Nhật Bản','Đạm']}),
  d('Trứng cuộn rong biển',10,[['Trứng gà',2,'quả'],['Rong biển khô',5]],{veg:true,costTier:'thap',method:'friedegg',preparation:'stirfry',proteinGroup:'egg',cuisineStyle:'han-nhat',tags:['Hàn Quốc','Đạm']}),
  d('Cơm trộn Bibimbap dọn tủ',20,[['Thịt bò',80],['Cà rốt',40],['Cải bó xôi',40],['Trứng gà',1,'quả'],['Kim chi',30]],{costTier:'cao',method:'stirfry',preparation:'stirfry',proteinGroup:'beef',cuisineStyle:'han-nhat',tags:['Hàn Quốc','Dọn tủ lạnh']}),
  // Âu-Mỹ tinh gọn
  d('Mì Ý sốt bò bằm',20,[['Mì Ý',80],['Thịt bò',80],['Cà chua',60]],{costTier:'vua',method:'braise',preparation:'braise',proteinGroup:'beef',cuisineStyle:'au-my',tags:['Ý','No bụng']}),
  d('Salad ức gà sốt mè rang',15,[['Ức gà hoặc đùi gà',110],['Xà lách',80],['Sốt mè rang',15]],{costTier:'vua',method:'raw',preparation:'raw',proteinGroup:'chicken',cuisineStyle:'au-my',tags:['Salad','Đạm nạc']}),
  d('Bò lúc lắc ớt chuông',15,[['Thịt bò',110],['Ớt chuông',60]],{costTier:'cao',method:'stirfry',preparation:'stirfry',proteinGroup:'beef',cuisineStyle:'au-my',tags:['Âu-Mỹ','Đạm']}),
];

export const RAU: Dish[] = [
  d('Bí đỏ hấp',12,[['Bí đỏ',100]],{tags:['Beta-caroten','Kali']}),
  d('Cà rốt & khoai lang hấp',15,[['Cà rốt',50],['Khoai lang',60]],{tags:['Vitamin A','Chất xơ']}),
  d('Bông cải xanh luộc',5,[['Bông cải xanh',100]],{tags:['Vitamin C','Canxi']}),
  d('Rau muống/rau lang luộc',4,[['Rau muống hoặc rau lang',100]],{tags:['Sắt','Chất xơ']}),
  d('Cải thìa luộc tỏi',4,[['Cải thìa',100]],{tags:['Canxi']}),
  d('Su su/đậu que hấp',8,[['Su su hoặc đậu que',100]],{tags:['Chất xơ']}),
  d('Bắp cải hấp mềm',8,[['Bắp cải',100]],{tags:['Vitamin C']}),
  d('Đậu bắp hấp',8,[['Đậu bắp',100]],{tags:['Chất xơ']}),
  d('Cải bó xôi luộc',4,[['Cải bó xôi',100]],{tags:['Sắt','Canxi']}),
  d('Giá đỗ xào nhẹ',5,[['Giá đỗ',100]],{method:'stirfry',tags:['Vitamin C']}),
  d('Măng tây luộc',6,[['Măng tây',100]],{tags:['Chất xơ','Vitamin']}),
  d('Bí xanh hấp',10,[['Bí xanh',100]],{tags:['Thanh mát']}),
  d('Rau dền luộc',4,[['Rau dền',100]],{tags:['Sắt','Canxi']}),
  d('Cà tím hấp',10,[['Cà tím',100]],{tags:['Chất xơ']}),
  d('Cà rốt luộc',8,[['Cà rốt',100]],{tags:['Vitamin A']}),
  d('Bầu luộc',8,[['Bầu',100]],{tags:['Thanh mát']}),
  d('Bí xanh luộc gừng',10,[['Bí xanh',120],['Gừng',3]],{method:'boil',preparation:'boil',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Thanh mát','Dễ tiêu']}),
  d('Rau ngót xào tỏi nhẹ',7,[['Rau ngót',100]],{method:'stirfry',preparation:'stirfry',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Sắt','Chất xơ']}),
  d('Mồng tơi luộc',5,[['Mồng tơi',100]],{method:'boil',preparation:'boil',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Thanh mát','Chất xơ']}),
  d('Cải thảo hấp gừng',8,[['Cải thảo',120],['Gừng',3]],{method:'steam',preparation:'steam',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Dễ tiêu','Vitamin C']}),
  d('Bông cải xanh hấp cà rốt',10,[['Bông cải xanh',80],['Cà rốt',50]],{method:'steam',preparation:'steam',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Vitamin C','Vitamin A']}),
  d('Đậu bắp luộc chấm chanh',8,[['Đậu bắp',120],['Chanh',5]],{method:'boil',preparation:'boil',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Chất xơ','Thanh nhẹ']}),
  d('Su su xào cà rốt',10,[['Su su hoặc đậu que',100],['Cà rốt',40]],{method:'stirfry',preparation:'stirfry',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Chất xơ','Vitamin A']}),
  d('Bông cải xanh xào nấm',10,[['Bông cải xanh',80],['Nấm rơm hoặc nấm bào ngư',60]],{veg:true,method:'stirfry',preparation:'stirfry',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Chất xơ','Chay']}),
  d('Cải thìa hấp nấm',9,[['Cải thìa',100],['Nấm rơm hoặc nấm bào ngư',40]],{veg:true,method:'steam',preparation:'steam',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Canxi','Chất xơ']}),
  d('Bí đỏ nghiền đậu hũ',12,[['Bí đỏ',100],['Đậu hũ',50]],{veg:true,method:'boilsteam',preparation:'boil',costTier:'thap',proteinGroup:'soy',allergens:['đậu nành'],tags:['Beta-caroten','Đạm thực vật']}),
  d('Rau muống xào nấm nhẹ',8,[['Rau muống hoặc rau lang',100],['Nấm rơm hoặc nấm bào ngư',40]],{veg:true,method:'stirfry',preparation:'stirfry',costTier:'thap',proteinGroup:'plant',allergens:[],tags:['Sắt','Chất xơ']}),
];

export const CANH: Dish[] = [
  d('Canh bí đỏ nấu tôm khô',15,[['Bí đỏ',80],['Tôm khô',5]]),
  d('Canh rau ngót thịt bằm',12,[['Rau ngót',60],['Thịt heo xay',20]]),
  d('Canh bầu nấu tôm',12,[['Bầu',80],['Tôm tươi',20]]),
  d('Canh mồng tơi nấu tôm',10,[['Mồng tơi',60],['Tôm tươi',20]]),
  d('Canh mướp nấu tôm khô',10,[['Mướp',80],['Tôm khô',5]]),
  d('Canh cải thảo thịt viên',15,[['Cải thảo',60],['Thịt heo xay',20]]),
  d('Canh chua cá nhẹ',20,[['Cá lóc hoặc cá basa',60],['Cà chua',40],['Dứa',30]]),
  d('Canh đậu hũ cà chua',10,[['Đậu hũ',60],['Cà chua',40]],{veg:true}),
  d('Canh khoai sọ nấu tôm',15,[['Khoai sọ',70],['Tôm tươi',20]]),
  d('Canh cải bó xôi thịt bằm',10,[['Cải bó xôi',60],['Thịt heo xay',20]]),
  d('Canh su su nấu tôm',12,[['Su su hoặc đậu que',70],['Tôm tươi',20]]),
  d('Canh bí xanh nấu sườn',20,[['Bí xanh',70],['Sườn non',30]]),
  d('Canh trứng cà chua',8,[['Trứng gà',.4,'quả'],['Cà chua',50]],{veg:true}),
  d('Canh rau dền nấu tôm',10,[['Rau dền',60],['Tôm tươi',20]]),
  d('Canh đậu bắp nấu tôm',12,[['Đậu bắp',70],['Tôm tươi',20]]),
  d('Canh mồng tơi nấu thịt bằm',10,[['Mồng tơi',60],['Thịt heo xay',20]]),
  d('Canh nấm đậu hũ',10,[['Nấm rơm hoặc nấm bào ngư',60],['Đậu hũ',60]],{veg:true}),
  d('Canh bí đỏ chay',10,[['Bí đỏ',100]],{veg:true}),
  d('Canh rau ngót chay',8,[['Rau ngót',70]],{veg:true}),
  d('Canh chua đậu hũ',12,[['Đậu hũ',80],['Cà chua',50]],{veg:true}),
  d('Canh rau ngót nấu tôm',12,[['Rau ngót',70],['Tôm tươi',25]],{costTier:'vua',method:'soup',preparation:'soup',proteinGroup:'seafood',allergens:['tôm'],tags:['Sắt','Canxi']}),
  d('Canh bầu thịt bằm',15,[['Bầu',80],['Thịt heo xay',25]],{costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'pork',allergens:[],tags:['Thanh mát','Đạm']}),
  d('Canh cải thảo nấu tôm',12,[['Cải thảo',80],['Tôm tươi',25]],{costTier:'vua',method:'soup',preparation:'soup',proteinGroup:'seafood',allergens:['tôm'],tags:['Canxi','Dễ tiêu']}),
  d('Canh bí xanh nấu thịt viên',18,[['Bí xanh',80],['Thịt heo xay',30]],{costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'pork',allergens:[],tags:['Thanh mát','Đạm']}),
  d('Canh cà chua trứng rau ngót',12,[['Cà chua',50],['Trứng gà',.5,'quả'],['Rau ngót',40]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'egg',allergens:['trứng'],tags:['Đạm','Sắt']}),
  d('Canh nấm đậu hũ bí đỏ',15,[['Nấm rơm hoặc nấm bào ngư',50],['Đậu hũ',60],['Bí đỏ',40]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'soy',allergens:['đậu nành'],tags:['Đạm thực vật','Dễ tiêu']}),
  d('Canh mướp nấu thịt bằm',12,[['Mướp',80],['Thịt heo xay',25]],{costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'pork',allergens:[],tags:['Thanh mát','Đạm']}),
  d('Canh khoai sọ thịt bằm',20,[['Khoai sọ',70],['Thịt heo xay',25]],{costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'pork',allergens:[],tags:['No lâu','Đạm']}),
  d('Canh bông cải xanh đậu hũ',12,[['Bông cải xanh',70],['Đậu hũ',60]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'soy',allergens:['đậu nành'],tags:['Canxi','Chất xơ']}),
  d('Canh cá basa cà chua',18,[['Cá basa hoặc cá lóc phi lê',60],['Cà chua',50]],{costTier:'vua',method:'soup',preparation:'soup',proteinGroup:'fish',allergens:[],tags:['Omega-3','Ấm bụng']}),
  d('Canh bông cải xanh nấu nấm',12,[['Bông cải xanh',70],['Nấm rơm hoặc nấm bào ngư',50]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'plant',allergens:[],tags:['Vitamin C','Chất xơ']}),
  d('Canh bí đỏ đậu hũ',15,[['Bí đỏ',80],['Đậu hũ',60]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'soy',allergens:['đậu nành'],tags:['Beta-caroten','Đạm thực vật']}),
  d('Canh cải thìa nấu cá',15,[['Cải thìa',70],['Cá basa hoặc cá lóc phi lê',50]],{costTier:'vua',method:'soup',preparation:'soup',proteinGroup:'fish',allergens:[],tags:['Canxi','Omega-3']}),
  d('Canh mướp nấu nấm',12,[['Mướp',80],['Nấm rơm hoặc nấm bào ngư',50]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'plant',allergens:[],tags:['Thanh mát','Chất xơ']}),
  // Đặc sản 3 miền
  d('Canh sấu thịt bằm',15,[['Thịt heo xay',30],['Quả sấu',20]],{costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'pork',allergens:[],cuisineStyle:'dac-san-3-mien',tags:['Đặc sản miền Bắc','Thanh mát']}),
  d('Canh chua bông điền điển',15,[['Tôm tươi',30],['Bông điền điển',60],['Cà chua',30]],{costTier:'vua',method:'soup',preparation:'soup',proteinGroup:'seafood',allergens:['tôm'],cuisineStyle:'dac-san-3-mien',tags:['Đặc sản miền Tây','Mùa nước nổi']}),
  // Hàn Quốc & Nhật Bản
  d('Canh kim chi đậu hũ',12,[['Kim chi',50],['Đậu hũ',60]],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'soy',allergens:['đậu nành'],cuisineStyle:'han-nhat',tags:['Hàn Quốc','Chua cay nhẹ']}),
  d('Canh rong biển thịt bằm',12,[['Rong biển khô',5],['Thịt heo xay',30]],{costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'pork',allergens:[],cuisineStyle:'han-nhat',tags:['Hàn Quốc','Canh sinh nhật']}),
  // Âu-Mỹ tinh gọn
  d('Súp kem bí đỏ',15,[['Bí đỏ',100],['Sữa tươi không đường',80,'ml']],{veg:true,costTier:'thap',method:'soup',preparation:'soup',proteinGroup:'plant',allergens:['sữa'],cuisineStyle:'au-my',tags:['Âu-Mỹ','Kem mịn']}),
];

export const ALL_DISHES = [
  ...BREAKFAST.map((x) => ({ ...x, type: 'sang' as const })),
  ...DAM.map((x) => ({ ...x, type: 'dam' as const })),
  ...RAU.map((x) => ({ ...x, type: 'rau' as const })),
  ...CANH.map((x) => ({ ...x, type: 'canh' as const })),
];

export const PRICE: Record<string, { perKg?: number; perLiter?: number; perPiece?: number }> = {
  'Cá basa hoặc cá lóc phi lê':{perKg:100000},'Cá lóc hoặc cá basa':{perKg:100000},'Tôm tươi':{perKg:180000},'Trứng gà':{perPiece:3000},'Thịt heo xay':{perKg:120000},'Cá diêu hồng':{perKg:70000},'Sườn non':{perKg:160000},'Ức gà hoặc đùi gà':{perKg:70000},'Đậu hũ':{perKg:16000},'Tôm khô':{perKg:350000},'Cá hồi':{perKg:320000},'Mực tươi':{perKg:150000},'Gan heo':{perKg:90000},'Chả cá':{perKg:130000},'Trứng cút':{perPiece:800},'Chả lụa':{perKg:120000},'Gừng':{perKg:40000},'Hành lá':{perKg:30000},'Sả':{perKg:25000},'Hành tím':{perKg:40000},'Nấm rơm hoặc nấm bào ngư':{perKg:60000},'Lá chanh':{perPiece:200},'Chanh':{perKg:30000},'Bí đỏ':{perKg:15000},'Cà rốt':{perKg:20000},'Khoai lang':{perKg:20000},'Khoai sọ':{perKg:20000},'Bông cải xanh':{perKg:45000},'Rau muống hoặc rau lang':{perKg:12000},'Cải thìa':{perKg:18000},'Su su hoặc đậu que':{perKg:20000},'Bắp cải':{perKg:12000},'Rau ngót':{perKg:15000},'Bầu':{perKg:15000},'Mồng tơi':{perKg:12000},'Mướp':{perKg:15000},'Cải thảo':{perKg:15000},'Cà chua':{perKg:25000},'Dứa':{perKg:15000},'Đậu bắp':{perKg:25000},'Cải bó xôi':{perKg:30000},'Giá đỗ':{perKg:15000},'Măng tây':{perKg:90000},'Bí xanh':{perKg:15000},'Rau dền':{perKg:15000},'Cà tím':{perKg:18000},'Gạo tẻ':{perKg:20000},'Gạo nếp':{perKg:28000},'Đậu xanh':{perKg:45000},'Bánh phở':{perKg:20000},'Bún gạo':{perKg:18000},'Bánh cuốn':{perKg:30000},'Yến mạch':{perKg:60000},'Chuối':{perKg:20000},'Sữa tươi không đường':{perLiter:35000},'Bánh mì':{perPiece:5000},'Thịt bò':{perKg:260000},'Lòng heo':{perKg:110000},'Cá bống':{perKg:90000},'Cá thu':{perKg:140000},'Sốt Teriyaki':{perKg:80000},'Rong biển khô':{perKg:150000},'Kim chi':{perKg:60000},'Mì Ý':{perKg:35000},'Xà lách':{perKg:25000},'Sốt mè rang':{perKg:60000},'Ớt chuông':{perKg:35000},'Quả sấu':{perKg:35000},'Bông điền điển':{perKg:40000},
};

export const NUTRITION_PER_100G: Record<string, {cal:number; pro:number; fat:number; carb:number}> = {
  'Cá basa hoặc cá lóc phi lê':{cal:100,pro:18,fat:3,carb:0},'Cá lóc hoặc cá basa':{cal:100,pro:18,fat:3,carb:0},'Tôm tươi':{cal:85,pro:18,fat:1,carb:1},'Trứng gà':{cal:155,pro:13,fat:11,carb:1},'Thịt heo xay':{cal:250,pro:17,fat:20,carb:0},'Cá diêu hồng':{cal:96,pro:20,fat:1.5,carb:0},'Sườn non':{cal:280,pro:17,fat:23,carb:0},'Ức gà hoặc đùi gà':{cal:165,pro:25,fat:7,carb:0},'Đậu hũ':{cal:76,pro:8,fat:4.8,carb:1.9},'Tôm khô':{cal:280,pro:55,fat:3,carb:3},'Cá hồi':{cal:208,pro:20,fat:13,carb:0},'Mực tươi':{cal:92,pro:16,fat:1.4,carb:3},'Gan heo':{cal:165,pro:21,fat:4.5,carb:5},'Chả cá':{cal:150,pro:12,fat:8,carb:8},'Trứng cút':{cal:158,pro:13,fat:11,carb:.4},'Chả lụa':{cal:250,pro:15,fat:20,carb:3},'Gừng':{cal:80,pro:1.8,fat:.8,carb:18},'Hành lá':{cal:32,pro:1.8,fat:.2,carb:7},'Sả':{cal:99,pro:1.8,fat:.5,carb:25},'Hành tím':{cal:40,pro:1.1,fat:.1,carb:9},'Nấm rơm hoặc nấm bào ngư':{cal:35,pro:3,fat:.5,carb:5},'Chanh':{cal:29,pro:1,fat:.3,carb:9},'Bí đỏ':{cal:26,pro:1,fat:.1,carb:6.5},'Cà rốt':{cal:41,pro:.9,fat:.2,carb:10},'Khoai lang':{cal:86,pro:1.6,fat:.1,carb:20},'Khoai sọ':{cal:112,pro:1.5,fat:.2,carb:26},'Bông cải xanh':{cal:34,pro:2.8,fat:.4,carb:7},'Rau muống hoặc rau lang':{cal:19,pro:2.6,fat:.2,carb:3.1},'Cải thìa':{cal:13,pro:1.5,fat:.2,carb:2.2},'Su su hoặc đậu que':{cal:19,pro:.8,fat:.1,carb:4.5},'Bắp cải':{cal:25,pro:1.3,fat:.1,carb:5.8},'Rau ngót':{cal:35,pro:4.2,fat:.4,carb:4.5},'Bầu':{cal:15,pro:.6,fat:.1,carb:3.4},'Mồng tơi':{cal:19,pro:1.8,fat:.3,carb:3.4},'Mướp':{cal:17,pro:1.2,fat:.2,carb:3.4},'Cải thảo':{cal:16,pro:1.2,fat:.2,carb:3.2},'Cà chua':{cal:18,pro:.9,fat:.2,carb:3.9},'Dứa':{cal:50,pro:.5,fat:.1,carb:13},'Đậu bắp':{cal:33,pro:1.9,fat:.2,carb:7},'Cải bó xôi':{cal:23,pro:2.9,fat:.4,carb:3.6},'Giá đỗ':{cal:30,pro:3,fat:.2,carb:5.9},'Măng tây':{cal:20,pro:2.2,fat:.1,carb:3.9},'Bí xanh':{cal:13,pro:.4,fat:.2,carb:3},'Rau dền':{cal:23,pro:2.5,fat:.3,carb:4},'Cà tím':{cal:25,pro:1,fat:.2,carb:6},'Gạo tẻ':{cal:365,pro:7,fat:.7,carb:80},'Gạo nếp':{cal:370,pro:7.5,fat:1,carb:81},'Đậu xanh':{cal:347,pro:23,fat:1.2,carb:63},'Bánh phở':{cal:109,pro:2,fat:.2,carb:25},'Bún gạo':{cal:109,pro:2,fat:.2,carb:25},'Bánh cuốn':{cal:150,pro:3,fat:2,carb:30},'Yến mạch':{cal:389,pro:17,fat:7,carb:66},'Chuối':{cal:89,pro:1.1,fat:.3,carb:23},'Sữa tươi không đường':{cal:42,pro:3.4,fat:1,carb:5},'Bánh mì':{cal:265,pro:9,fat:3.2,carb:49},'Thịt bò':{cal:250,pro:26,fat:15,carb:0},'Lòng heo':{cal:150,pro:15,fat:9,carb:2},'Cá bống':{cal:95,pro:18,fat:2,carb:0},'Cá thu':{cal:140,pro:19,fat:6,carb:0},'Sốt Teriyaki':{cal:90,pro:2,fat:.2,carb:18},'Rong biển khô':{cal:45,pro:5,fat:.6,carb:9},'Kim chi':{cal:15,pro:1.1,fat:.5,carb:2.4},'Mì Ý':{cal:131,pro:5,fat:1.1,carb:25},'Xà lách':{cal:15,pro:1.4,fat:.2,carb:2.9},'Sốt mè rang':{cal:280,pro:6,fat:22,carb:15},'Ớt chuông':{cal:31,pro:1,fat:.3,carb:6},'Quả sấu':{cal:40,pro:.5,fat:.2,carb:10},'Bông điền điển':{cal:25,pro:2.5,fat:.3,carb:4},
};

export const DAY_NAMES = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];
export const RICE_PER_UNIT = 90;
export const DAILY_TARGET = { kid:{ calories:1400, protein:25 }, elderly:{ calories:1800, protein:50 }, adult:{ calories:2000, protein:55 } };
export const PANTRY_COST = { tietkiem:22000, vua:35000, thoaimai:50000 };

export const SHOPPING_AFFILIATE_LINKS: Record<string, string> = {
  'Gạo tẻ': 'https://s.shopee.vn/4qFhbBBQ6j',
  'Tôm khô': 'https://s.shopee.vn/3B7TcCtTpm',
  'Bánh mì': 'https://s.shopee.vn/4fwHP1hgar',
  'Gạo nếp': 'https://s.shopee.vn/4B00oBcTxB',
  'Đậu xanh': 'https://s.shopee.vn/6Al5BxSNNW',
  'Bánh phở': 'https://s.shopee.vn/9peNYueAbZ',
  'Bún gạo': 'https://s.shopee.vn/7ptJBHOqg8',
};