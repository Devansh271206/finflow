// TODO: no backend endpoint yet
import { supabase } from "../lib/supabase";

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw error || new Error("User not authenticated");
  }

  return user;
}

export async function getBills() {
  try {
    const user = await getAuthenticatedUser();
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true });

    if (error) {
      // Fallback: check if we can query recurring_transactions, using only real stored fields
      const { data: recData, error: recError } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", user.id);

      if (!recError && recData && recData.length > 0) {
        const mapped = recData
          .filter((item) => item.due_date || item.next_due_date) // only include entries with a real due date
          .map((item) => ({
            id: item.id,
            name: item.merchant || item.title || "Subscription",
            amount: Number(item.amount || 0),
            dueDate: item.due_date || item.next_due_date,
            autoPay: item.auto_pay ?? item.autopay ?? false,
            category: item.category || "Software",
          }));
        return { data: mapped, error: null };
      }
      return { data: [], error };
    }

    const normalized = (data || []).map(row => ({
      id: row.id,
      name: row.name || row.title || "Bill",
      amount: Math.abs(Number(row.amount || 0)),
      dueDate: row.due_date || row.deadline || "",
      autoPay: row.auto_pay ?? row.autopay ?? false,
      category: row.category || "General",
    }));

    return { data: normalized, error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function addBill(bill) {
  try {
    const user = await getAuthenticatedUser();
    const payload = {
      user_id: user.id,
      name: bill.name,
      amount: Math.abs(Number(bill.amount || 0)),
      due_date: bill.dueDate,
      auto_pay: bill.autoPay || false,
      category: bill.category || "General",
    };

    const { data, error } = await supabase
      .from("bills")
      .insert([payload])
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateBill(id, updates) {
  try {
    const user = await getAuthenticatedUser();
    const payload = {
      name: updates.name,
      amount: updates.amount ? Math.abs(Number(updates.amount)) : undefined,
      due_date: updates.dueDate,
      auto_pay: updates.autoPay,
      category: updates.category,
    };

    const { data, error } = await supabase
      .from("bills")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteBill(id) {
  try {
    const user = await getAuthenticatedUser();
    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    return { data: true, error };
  } catch (error) {
    return { data: null, error };
  }
}
