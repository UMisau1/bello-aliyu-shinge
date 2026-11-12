
import { supabase } from "./supabase-config.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "Checking login...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = "Login failed: " + error.message;
    return;
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError || !admin || admin.role !== "super_admin") {
    await supabase.auth.signOut();
    message.textContent = "Access denied. Admin permission required.";
    return;
  }

  message.textContent = "Login successful. Admin verified.";
});
