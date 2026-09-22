const readline = require("readline");
const { handleMessage, flattenReply } = require("../bot");

let orderNo = 100;
const mockSaveOrder = async (cart, from, total) => {
  orderNo += 1;
  return { orderNo, lines: cart };
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const from = "919000000000";
console.log("======================================");
console.log("WhatsApp Grocery Bot - Local Simulator");
console.log('Type "hi" to start. "exit" to quit.');
console.log("======================================");

function prompt() {
  rl.question("\nyou> ", async (input) => {
    if (input.trim().toLowerCase() === "exit") {
      rl.close();
      return process.exit(0);
    }
    const reply = await handleMessage(from, { kind: "text", text: input }, mockSaveOrder);
    console.log("\nbot> " + flattenReply(reply));
    prompt();
  });
}

prompt();