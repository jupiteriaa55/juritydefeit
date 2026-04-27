// Заказы от родственников усопшего.
// Алгоритм: при принятии нового заказа выбираем имя, целевой стиль (1..4 уровня),
// бюджет (макс. сумма, выше которой родственники не смогут оплатить),
// и срок (3..7 дней). Сдача рассчитывает прибыль:
//   • если стиль участка слишком низкий vs ожидание — штраф (отказ);
//   • если затраты выше бюджета — оплата срезается (родственники не смогли);
//   • если в срок — бонус;
//   • дополнительно бонусы за дорожки рядом и цветы.

const FIRST_NAMES_M = ['Иван', 'Пётр', 'Алексей', 'Николай', 'Михаил', 'Виктор', 'Дмитрий', 'Сергей', 'Юрий', 'Аркадий', 'Геннадий', 'Анатолий', 'Игорь', 'Максим', 'Андрей', 'Степан', 'Фёдор'];
const FIRST_NAMES_F = ['Анна', 'Мария', 'Татьяна', 'Ольга', 'Елена', 'Ирина', 'Светлана', 'Людмила', 'Зинаида', 'Раиса', 'Антонина', 'Валентина', 'Галина', 'Лариса', 'Маргарита'];
const LAST_M = ['Иванов', 'Петров', 'Соколов', 'Кузнецов', 'Смирнов', 'Васильев', 'Морозов', 'Волков', 'Орлов', 'Зайцев', 'Лебедев', 'Тихонов', 'Григорьев', 'Дроздов', 'Беляев'];
const PATRO_M = ['Иванович', 'Петрович', 'Сергеевич', 'Николаевич', 'Алексеевич', 'Михайлович', 'Юрьевич', 'Дмитриевич', 'Александрович'];
const PATRO_F = ['Ивановна', 'Петровна', 'Сергеевна', 'Николаевна', 'Алексеевна', 'Михайловна', 'Юрьевна', 'Дмитриевна', 'Александровна'];

function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

const STYLE_LEVELS = [
  { id: 1, name: 'Скромное',  minStyle: 2,  expBudget: 60,  reward: 80 },
  { id: 2, name: 'Достойное', minStyle: 6,  expBudget: 140, reward: 200 },
  { id: 3, name: 'Богатое',   minStyle: 12, expBudget: 280, reward: 420 },
  { id: 4, name: 'Шикарное',  minStyle: 20, expBudget: 500, reward: 780 },
];

let _orderCounter = 1;

export function generateOrder(rand = Math.random, day = 1) {
  const female = rand() < 0.4;
  const fn = pick(female ? FIRST_NAMES_F : FIRST_NAMES_M, rand);
  const ln = pick(LAST_M, rand) + (female ? 'а' : '');
  const pat = pick(female ? PATRO_F : PATRO_M, rand);
  const fullName = `${ln} ${fn} ${pat}`;

  // Уровень повышается со временем (в среднем).
  const lvlIdx = Math.min(STYLE_LEVELS.length - 1, Math.max(0, Math.floor(rand() * 4 - (4 - day / 4))));
  const lvl = STYLE_LEVELS[Math.max(0, Math.min(STYLE_LEVELS.length - 1, lvlIdx))];

  return {
    id: `o${_orderCounter++}`,
    name: fullName,
    level: lvl.id,
    levelName: lvl.name,
    minStyle: lvl.minStyle,
    expBudget: lvl.expBudget,
    reward: lvl.reward,
    deadline: 3 + Math.floor(rand() * 5), // 3..7 дней
    daysLeft: 3 + Math.floor(rand() * 5),
    spent: 0,
    cellX: null,
    cellZ: null,
    nameWritten: false,
    finished: false,
  };
}

// Подсчитывает результат сдачи заказа.
//   styleAtCell — стиль самого надгробия+бонус соседства;
//   spent — потраченная сумма.
// Возвращает { ok, payment, message }.
export function evaluateOrder(order, styleAtCell, neighborBonus) {
  const totalStyle = styleAtCell + neighborBonus;
  if (!order.nameWritten) {
    return { ok: false, payment: 0, message: 'Не написано имя на надгробии — родственники в гневе!' };
  }
  if (totalStyle < order.minStyle) {
    return { ok: false, payment: 0, message: `Слишком скромно (стиль ${totalStyle.toFixed(1)}/${order.minStyle}). Родственники отказываются платить.` };
  }
  // Превышение бюджета (родственники могут оплатить максимум expBudget * 1.4).
  let payment = order.reward;
  const cap = order.expBudget * 1.4;
  if (order.spent > cap) {
    payment = Math.max(0, Math.round(order.reward - (order.spent - cap) * 0.6));
  }
  // Бонус за досрочную сдачу.
  if (order.daysLeft >= Math.ceil(order.deadline * 0.5)) payment = Math.round(payment * 1.15);
  // Штраф за просрочку.
  if (order.daysLeft < 0) payment = Math.round(payment * 0.5);

  // Бонус за хорошее соседство.
  payment += Math.round(neighborBonus * 8);

  // Профит = выплата − затраты.
  const profit = payment - order.spent;
  let message;
  if (profit > 0) message = `Семья очень довольна! Прибыль +${profit}⛀.`;
  else if (profit === 0) message = 'Заказ сдан в ноль.';
  else message = `Заказ сдан, но в убыток (${profit}⛀).`;
  return { ok: true, payment, profit, message };
}
