export type Ingredient = [string, number, string?];
export type Dish = {
  name: string;
  time: number;
  veg?: boolean;
  costTier?: 'thap' | 'vua' | 'cao';
  method?: string;
  tags?: string[];
  ing: Ingredient[];
  type?: 'sang' | 'dam' | 'rau' | 'canh';
};

const d = (name: string, time: number, ing: Ingredient[], extra: Partial<Dish> = {}): Dish => ({ name, time, ing, ...extra });

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
];

export const ALL_DISHES = [
  ...BREAKFAST.map((x) => ({ ...x, type: 'sang' as const })),
  ...DAM.map((x) => ({ ...x, type: 'dam' as const })),
  ...RAU.map((x) => ({ ...x, type: 'rau' as const })),
  ...CANH.map((x) => ({ ...x, type: 'canh' as const })),
];

export const PRICE: Record<string, { perKg?: number; perLiter?: number; perPiece?: number }> = {
  'Cá basa hoặc cá lóc phi lê':{perKg:100000},'Cá lóc hoặc cá basa':{perKg:100000},'Tôm tươi':{perKg:180000},'Trứng gà':{perPiece:3000},'Thịt heo xay':{perKg:120000},'Cá diêu hồng':{perKg:70000},'Sườn non':{perKg:160000},'Ức gà hoặc đùi gà':{perKg:70000},'Đậu hũ':{perKg:16000},'Tôm khô':{perKg:350000},'Cá hồi':{perKg:320000},'Mực tươi':{perKg:150000},'Gan heo':{perKg:90000},'Chả cá':{perKg:130000},'Trứng cút':{perPiece:800},'Chả lụa':{perKg:120000},'Gừng':{perKg:40000},'Hành lá':{perKg:30000},'Sả':{perKg:25000},'Hành tím':{perKg:40000},'Nấm rơm hoặc nấm bào ngư':{perKg:60000},'Lá chanh':{perPiece:200},'Chanh':{perKg:30000},'Bí đỏ':{perKg:15000},'Cà rốt':{perKg:20000},'Khoai lang':{perKg:20000},'Khoai sọ':{perKg:20000},'Bông cải xanh':{perKg:45000},'Rau muống hoặc rau lang':{perKg:12000},'Cải thìa':{perKg:18000},'Su su hoặc đậu que':{perKg:20000},'Bắp cải':{perKg:12000},'Rau ngót':{perKg:15000},'Bầu':{perKg:15000},'Mồng tơi':{perKg:12000},'Mướp':{perKg:15000},'Cải thảo':{perKg:15000},'Cà chua':{perKg:25000},'Dứa':{perKg:15000},'Đậu bắp':{perKg:25000},'Cải bó xôi':{perKg:30000},'Giá đỗ':{perKg:15000},'Măng tây':{perKg:90000},'Bí xanh':{perKg:15000},'Rau dền':{perKg:15000},'Cà tím':{perKg:18000},'Gạo tẻ':{perKg:20000},'Gạo nếp':{perKg:28000},'Đậu xanh':{perKg:45000},'Bánh phở':{perKg:20000},'Bún gạo':{perKg:18000},'Bánh cuốn':{perKg:30000},'Yến mạch':{perKg:60000},'Chuối':{perKg:20000},'Sữa tươi không đường':{perLiter:35000},'Bánh mì':{perPiece:5000},
};

export const NUTRITION_PER_100G: Record<string, {cal:number; pro:number; fat:number; carb:number}> = {
  'Cá basa hoặc cá lóc phi lê':{cal:100,pro:18,fat:3,carb:0},'Cá lóc hoặc cá basa':{cal:100,pro:18,fat:3,carb:0},'Tôm tươi':{cal:85,pro:18,fat:1,carb:1},'Trứng gà':{cal:155,pro:13,fat:11,carb:1},'Thịt heo xay':{cal:250,pro:17,fat:20,carb:0},'Cá diêu hồng':{cal:96,pro:20,fat:1.5,carb:0},'Sườn non':{cal:280,pro:17,fat:23,carb:0},'Ức gà hoặc đùi gà':{cal:165,pro:25,fat:7,carb:0},'Đậu hũ':{cal:76,pro:8,fat:4.8,carb:1.9},'Tôm khô':{cal:280,pro:55,fat:3,carb:3},'Cá hồi':{cal:208,pro:20,fat:13,carb:0},'Mực tươi':{cal:92,pro:16,fat:1.4,carb:3},'Gan heo':{cal:165,pro:21,fat:4.5,carb:5},'Chả cá':{cal:150,pro:12,fat:8,carb:8},'Trứng cút':{cal:158,pro:13,fat:11,carb:.4},'Chả lụa':{cal:250,pro:15,fat:20,carb:3},'Gừng':{cal:80,pro:1.8,fat:.8,carb:18},'Hành lá':{cal:32,pro:1.8,fat:.2,carb:7},'Sả':{cal:99,pro:1.8,fat:.5,carb:25},'Hành tím':{cal:40,pro:1.1,fat:.1,carb:9},'Nấm rơm hoặc nấm bào ngư':{cal:35,pro:3,fat:.5,carb:5},'Chanh':{cal:29,pro:1,fat:.3,carb:9},'Bí đỏ':{cal:26,pro:1,fat:.1,carb:6.5},'Cà rốt':{cal:41,pro:.9,fat:.2,carb:10},'Khoai lang':{cal:86,pro:1.6,fat:.1,carb:20},'Khoai sọ':{cal:112,pro:1.5,fat:.2,carb:26},'Bông cải xanh':{cal:34,pro:2.8,fat:.4,carb:7},'Rau muống hoặc rau lang':{cal:19,pro:2.6,fat:.2,carb:3.1},'Cải thìa':{cal:13,pro:1.5,fat:.2,carb:2.2},'Su su hoặc đậu que':{cal:19,pro:.8,fat:.1,carb:4.5},'Bắp cải':{cal:25,pro:1.3,fat:.1,carb:5.8},'Rau ngót':{cal:35,pro:4.2,fat:.4,carb:4.5},'Bầu':{cal:15,pro:.6,fat:.1,carb:3.4},'Mồng tơi':{cal:19,pro:1.8,fat:.3,carb:3.4},'Mướp':{cal:17,pro:1.2,fat:.2,carb:3.4},'Cải thảo':{cal:16,pro:1.2,fat:.2,carb:3.2},'Cà chua':{cal:18,pro:.9,fat:.2,carb:3.9},'Dứa':{cal:50,pro:.5,fat:.1,carb:13},'Đậu bắp':{cal:33,pro:1.9,fat:.2,carb:7},'Cải bó xôi':{cal:23,pro:2.9,fat:.4,carb:3.6},'Giá đỗ':{cal:30,pro:3,fat:.2,carb:5.9},'Măng tây':{cal:20,pro:2.2,fat:.1,carb:3.9},'Bí xanh':{cal:13,pro:.4,fat:.2,carb:3},'Rau dền':{cal:23,pro:2.5,fat:.3,carb:4},'Cà tím':{cal:25,pro:1,fat:.2,carb:6},'Gạo tẻ':{cal:365,pro:7,fat:.7,carb:80},'Gạo nếp':{cal:370,pro:7.5,fat:1,carb:81},'Đậu xanh':{cal:347,pro:23,fat:1.2,carb:63},'Bánh phở':{cal:109,pro:2,fat:.2,carb:25},'Bún gạo':{cal:109,pro:2,fat:.2,carb:25},'Bánh cuốn':{cal:150,pro:3,fat:2,carb:30},'Yến mạch':{cal:389,pro:17,fat:7,carb:66},'Chuối':{cal:89,pro:1.1,fat:.3,carb:23},'Sữa tươi không đường':{cal:42,pro:3.4,fat:1,carb:5},'Bánh mì':{cal:265,pro:9,fat:3.2,carb:49},
};

export const DAY_NAMES = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];
export const RICE_PER_UNIT = 90;
export const DAILY_TARGET = { kid:{ calories:1400, protein:25 }, elderly:{ calories:1800, protein:50 }, adult:{ calories:2000, protein:55 } };
export const PANTRY_COST = { tietkiem:22000, vua:35000, thoaimai:50000 };