
const text = "This week saw 0 checkouts. Insufficient data to compute overall checkouts and utilization. Review prioritized actions below.";
const regex = /history is limited|limited history|limited data|short history|insufficient data/i;
const sentences = text.split(/(?<=[.!?])\s+/);
const filtered = sentences.filter(s => !regex.test(s));
console.log(filtered.join(" ").trim());

