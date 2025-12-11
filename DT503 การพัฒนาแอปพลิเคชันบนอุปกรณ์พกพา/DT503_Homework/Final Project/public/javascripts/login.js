// -----------------------------
// LOGIN
// -----------------------------
async function handleLogin() {
    const loginForm = document.querySelector("#loginForm");
    const email = loginForm.querySelector("#email").value.trim();
    const password = loginForm.querySelector("#password").value.trim();

    if (!email || !password) {
        alert("กรุณากรอกอีเมลและรหัสผ่าน");
        return;
    }

    try {
        const res = await fetch("/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            alert("❌ Error: " + data.message);
            return;
        }

        alert("เข้าสู่ระบบสำเร็จ!");
        window.location.href = "/";

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดที่เซิร์ฟเวอร์");
    }
}

// -----------------------------
// REGISTER
// -----------------------------
async function handleRegister() {
    const regForm = document.querySelector("#registerForm");

    const fullname = regForm.querySelector("#fullname").value.trim();
    const email = regForm.querySelector("input[name='email']").value.trim();
    const password = regForm.querySelector("#password").value.trim();
    const confirmPassword = regForm.querySelector("#confirmpassword").value.trim();

    if (!fullname || !email || !password || !confirmPassword) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    if (password !== confirmPassword) {
        alert("รหัสผ่านไม่ตรงกัน");
        return;
    }

    try {
        const res = await fetch("/api/users/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullname, email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            alert("❌ Error: " + data.message);
            return;
        }

        alert("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
        toggleForms("login");

    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดที่เซิร์ฟเวอร์");
    }
}
