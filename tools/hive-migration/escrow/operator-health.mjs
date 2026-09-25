import {readFileSync,writeFileSync,renameSync} from 'node:fs';
export function writeOperatorHealth(path,ready,now=Date.now()) {
  const temporary=path+'.tmp';
  writeFileSync(temporary,JSON.stringify({ready,checkedAt:now}),{mode:0o600});
  renameSync(temporary,path);
}
export function operatorReady(path,now=Date.now()) {
  try {const value=JSON.parse(readFileSync(path,'utf8'));return value.ready===true&&Number.isSafeInteger(value.checkedAt)&&now>=value.checkedAt&&now-value.checkedAt<60000;}
  catch {return false;}
}
