const Counter = require("../models/Counter");


async function generateItemCodes(count) {
  const counter = await Counter.findOneAndUpdate(
    { name: "itemCode" },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );

  const end = counter.seq;
  const start = end - count + 1;

  const codes = [];
  for (let i = start; i <= end; i++) {
    codes.push(`ITEM-${String(i).padStart(4, "0")}`);
  }

  return codes;
}


module.exports = generateItemCodes;
