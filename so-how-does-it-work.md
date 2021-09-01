# Discord QR 로그인 분석

1. 컴퓨터가 웹소켓 게이트웨이 `wss://remote-auth-gateway.discord.gg/?v=1`

이때 헤더의 User-Agent 값 검증 (여기서는 윈도우용 크롬 94로 스푸핑함)

웹소켓으로 주고받는 모든 데이터는 json 형태이고 op 값이 opcode임. 예:

```json
{
  "op": "an_opcode",
  "some_data": "some_data_value",
  "another_data": "another_data_value
}
```

2. 서버가 opcode hello를 보냄

| 키 | 타입 | 설명 |
| heartbeat_interval | Number | 밀리초 단위, 이 시간마다 heartbeat을 보내야함 |
| timeout_ms | Number | 밀리초 단위, 이 시간이 지나면 세션이 만료됨 |

3. 컴퓨터는 2번의 heartbeat_interval 밀리초마다 서버에 opcode heartbeat을 보내고 서버는 그때마다 opcode heartbeat_ack를 보냄. 둘다 별도의 데이터는 없음.

4. 컴퓨터는 이 세션에서 계속 사용할 임의의 rsa 키를 만듦. 이때 길이는 2048임.

5. 컴퓨터가 opcode init을 보냄

| 키 | 타입 | 설명 |
| encoded_public_key | string | 4번에서 만든 공개 키를 spki 형식, der 포맷으로 인코딩 후 base64 인코딩한 값(문자열 끝에 =이 없음) |

6. 서버가 opcode nonce_proof를 보냄

| 키 | 타입 | 설명
| encrypted_nonce | string | 임의의 값(nonce)를 5번에서 보낸 공개키로 암호화한 값을 base64로 인코딩한 값 |

7. 컴퓨터는 5번에서 받은 encrypted_nonce를 base64 디코딩 후 4번의 비밀키로 복호화함. 이때 oaep 해시는 SHA-256을 사용함.

8. 컴퓨터가 opcode nonce_proof를 보냄.

| 키 | 타입 | 설명 |
| proof | string | nonce값의 SHA-256 해시를 base64 인코딩한 값에서 /를 모두 \_로 변경, +를 모두 -로 변경, 앞에서부터 2개의 =을 지운 값 |

9. 서버가 opcode pending_remote_init을 보냄.

| 키 | 타입 | 설명 |
| fingerprint | string | qr코드 url을 만들기 위한 값 |

10. 컴퓨터는 `https://discord.com/ra/` 뒤에 9번에서 얻은 fingerprint 값을 붙인 값에 대한 QR코드를 표시함.

11. 폰에서 QR코드를 찍음.

12. 폰은 QR코드 url에서 fingerprint를 추출함

13. 폰은 `https://discord.com/api/users/@me/remote-auth`에 HTTP POST 요청을 보냄.

JSON 인코드된 데이터(body)

| 키 | 타입 | 설명 |
| fingerprint | string | 12번에서 추출한 값 |

요청 헤더

| 키 | 타입 | 설명 |
| Content-Type | string | 항상 `application/json` |
| Authorization | string | 유저의 Discord 토큰(`Bearer`를 포함하지 않음) |

14-1. 서버는 컴퓨터에 opcode pending_finish를 보냄.

| 키 | 타입 | 설명 |
| encrypted_user_payload | string | QR코드를 찍은 유저 정보를 5번에서 보낸 공개키로 암호화 후 base64 인코딩한 값 |

15-1. 컴퓨터는 14-1번의 encrypted_user_payload를 base64 디코딩한 후 4번의 비밀키로 복호화함. oaep 해시는 SHA-256임.

16-1. 15-1번의 값은 `(유저 id):(태그숫자):(아바타 해시):(닉네임)` 형태임. 이 값을 파싱해서 `휴대폰을 확인하세요` 메세지를 표시함.

14-2. 폰에서는 13번 데이터를 json 파싱 후 handshake_token 값을 저장함.

15-2. 로그인을 허락하겠냐는 메세지를 표시함.

16-2-1. Yes를 누르면 `https://discord.com/api/users/@me/remote-auth/finish`에 HTTP POST 요청을 보냄.

JSON 인코드된 데이터(body)

| 키 | 타입 | 설명 |
| handshake_token | string | 14-2의 handshake_token 값 |
| temporary_token | boolean | 항상 false |

요청 헤더

| 키 | 타입 | 설명 |
| Content-Type | string | 항상 `application/json` |
| Authorization | string | 유저의 Discord 토큰(`Bearer`를 포함하지 않음) |

16-2-2. No를 누르면 `https://discord.com/api/users/@me/remote-auth/cancel`에 HTTP POST 요청을 보냄.

JSON 인코드된 데이터(body)

| 키 | 타입 | 설명 |
| handshake_token | string | 14-2의 handshake_token 값 |

요청 헤더

| 키 | 타입 | 설명 |
| Content-Type | string | 항상 `application/json` |
| Authorization | string | 유저의 Discord 토큰(`Bearer`를 포함하지 않음) |

17-1. 폰에서 Yes를 누르면 서버는 컴퓨터에 opcode finish를 보냄.

| 키 | 타입 | 설명 |
| encrypted_token | string | 유저의 Discord 토큰을 5번에서 보낸 공개키로 암호화 후 base64 인코딩한 값 |

17-2. 폰에서 No를 눌렀으면 서버는 컴퓨터에 opcode cancel을 보냄. 별도의 데이터는 없음.

18. 폰에서 Yes를 눌렀으면 컴퓨터는 17-1의 encrypted_token을 base64 디코딩 후 4번의 비밀키로 복호화(oaep 해시는 SHA-256)한 토큰으로 로그인함.
