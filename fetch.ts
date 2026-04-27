import axios from 'axios';
axios.get('https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md').then(res => console.log(res.data)).catch(e => console.error(e.message));
