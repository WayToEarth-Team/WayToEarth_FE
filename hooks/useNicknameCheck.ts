import { useState } from "react";
import { Alert } from "react-native";
import { checkNickname } from "@utils/api/users";

export default function useNicknameCheck() {
  const [checked, setChecked] = useState(false);

  const handleCheck = async (nickname: string) => {
    try {
      const res = await checkNickname(nickname);
      if (res.available) {
        Alert.alert("사용 가능", "이 닉네임은 사용 가능합니다.");
        setChecked(true);
      } else {
        Alert.alert("중복 닉네임", "이미 사용 중인 닉네임입니다.");
        setChecked(false);
      }
    } catch (err) {
      Alert.alert("에러", "닉네임 확인 중 오류가 발생했어요.");
      setChecked(false);
    }
  };

  return { handleCheck, checked };
}
