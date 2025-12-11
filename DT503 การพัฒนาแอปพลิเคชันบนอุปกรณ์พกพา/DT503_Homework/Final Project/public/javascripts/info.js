const visualCard = document.getElementById("visualCard");
const inputNum = document.getElementById("inputCardNum");
const inputExp = document.getElementById("inputCardExp");
const inputCvv = document.getElementById("inputCardCvv");

const displayNum = document.getElementById("cardNumDisplay");
const displayExp = document.getElementById("cardExpDisplay");
const displayCvv = document.getElementById("cardCvvDisplay");

// 1. Update Number (พร้อมเว้นวรรค)
inputNum.addEventListener("input", (e) => {
  let val = e.target.value.replace(/\D/g, "").substring(0, 16); // รับเฉพาะตัวเลข
  let formatted = val.match(/.{1,4}/g)?.join(" ") || ""; // เว้นวรรคทุก 4 ตัว
  e.target.value = formatted;
  displayNum.innerText = formatted || "#### #### #### ####";
});

// 3. Update Expiry
inputExp.addEventListener("input", (e) => {
  // ลบทุกตัวที่ไม่ใช่ตัวเลข
  let value = e.target.value.replace(/\D/g, "");
  let month = parseInt(value.slice(0, 2));
  if (month > 12) month = 12;
  value = month.toString().padStart(2, "0") + value.slice(2);

  // จำกัดความยาวไม่เกิน 4 ตัว
  if (value.length > 4) value = value.slice(0, 4);

  // ใส่ / หลัง 2 ตัวแรก
  if (value.length >= 3) {
    value = value.slice(0, 2) + "/" + value.slice(2);
  }

  e.target.value = value;

  // update ค่าแสดงผล
  displayExp.innerText = value || "MM/YY";
});

inputCvv.addEventListener("input", (e) => {
  displayCvv.innerText = e.target.value || "***";
});
