export const upsertUserHandicap = async (
  supabase: any,
  profileId: string,
  handicap: number,
) => {
  return supabase
    .from('user_handicaps')
    .upsert(
      {
        profile_id: profileId,
        current_handicap: handicap,
      },
      { onConflict: 'profile_id' }
    )
    .select()
    .single();
};