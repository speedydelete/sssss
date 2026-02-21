
import {Pattern, DataPattern, createPattern} from '../../lifeweb/lib/index.js';
import {AdjustableGenerator} from './index.js';


const QUAD_WICKSTRETCHER: AdjustableGenerator & {rules: {[key: number]: [number, {[key: number]: [rule: string, min: number, flip: boolean, offset: number]}][]}} = {

    rules: {
        0: [
            [12, {
                0: ['B2ce3jknry4cijn5einry7e/S01c2ik3aeknr4twy5cnqy6in78', 60, false, 5],
                1: ['B2cik3aejk4cikr5ceny6ak8/S01c2-en3jknry4cjnqtw5ceiry6ac8', 61, true, 6],
                2: ['B2-an3-ciq4ciz5ceir6eik/S02ikn3cnry4nqtwz5aciky6ei7e', 74, false, 6],
                3: ['B2ce3eknry4crty5ceiqy6ei/S02aik3-aijk4aijn5aen8', 63, false, 6],
                4: ['B2cik3ajkn4cijqrz5eikny6ein8/S01c2-e3-acik4jnqt5k6kn8', 64, false, 6],
                5: ['B2cek3cenry4ik5eiky6ik7e/S02ik3ekqy4cij5cnqry6ik78', 41, true, 5],
                6: ['B2-ak3aenr4ikqrz5-ajkq6ei/S02-c3knqy4acijnqw5-aikq6ac7c', 78, false, 6],
                7: ['B2cek3ejnqr4ik5-ajnq6k7e8/S02i3-ceij4cijz5eknry6e8', 55, true, 6],
                8: ['B2cek3ejknr4ikr5ceiky6ikn7e/S02eik3-ceiq4cj5ceky6ek7e', 56, true, 6],
                9: ['B2cek3enr4ky5ceiky6ai7/S02eik3-ai4cijz5-ainq6i7e8', 69, false, 6],
                10: ['B2cek3cenry4ikyz5ikqy6akn8/S02aik3-ijnr4cj5inry6a', 70, true, 7],
                11: ['B2ce3enry4crt5aeijy6-kn7e/S02aik3-iknq4jktw5y6ak', 71, false, 6],
            }],
        ],
        1: [
            [12, {
                0: ['B2cek3-aikr4ik5-aq6in7c8/S02ei3-acq4ckz5-acj6ik8', 72, true, 7],
                1: ['B2ce3aenqy4kryz5cikry6-cn78/S02-ac3-ijn4cinqrwy5-eijn6ai7e', 49, true, 5],
                2: ['B2cek3eknr4kqz5-ejq6ein7e8/S02eik3cjkny4cerw5ekq6-ce', 74, true, 7],
                3: ['B2cek3-aijq4ikyz5eiky6ei7e8/S02ik3y4cjkrw5-ek6aik8', 75, false, 6],
                4: ['B2cek3-aikr4iq5jnqry6-ei78/S02ai3-aiq4ciknqyz5jkqry6ekn7', 76, false, 6],
                5: ['B2cek3-ai4ikqz5-ajqr6ain/S02aik3eknry4cejry5cikry6-ac7e8', 89, false, 7],
                6: ['B2ci3-ijnq4ijr5-acq6-c7c8/S01c2eik3-aikq4aiknz5ek6ain78', 66, true, 6],
                7: ['B2cen3ceny4krwy5eikny6-k8/S02eik3-ein4-ajktz5-ekny7c8', 67, false, 5],
                8: ['B2ce3eknqy4ikqz5-ej6eik7e8/S02-cn3acjry4ceikrwz5ceir6ik78', 68, false, 5],
                9: ['B2ci3-ijry4cjqyz5-acy6ain/S02-cn3-aik4aciq5acekr6cen7c8', 69, true, 6],
                10: ['B2ci3-inq4iqrtyz5ijkny6ain78/S01c2ein3-iq4ijnz5ijkn6ei7c8', 82, false, 6],
                11: ['B2ce3kqy4ckqrt5-kn6-cn8/S02-ce3acqry4-akntz5aceiy6-ck7e', 83, true, 7],
            }],
        ],
        2: [
            [12, {
                0: ['B2cek3-air4ikqr5-an6ae7/S02i3-acq4cqyz5-ijkn6ek8', 96, false, 8],
                1: ['B2cek3ekny4inrwy5cjry6k7c/S02ik3cry4-ky5-nq6-in7c', 73, false, 6],
                2: ['B2cek3-acir4ikqry5-anq6eik78/S02i3-aciq4cqy5-cjkn6aik8', 74, false, 6],
                3: ['B2ce3-acij4ckqrtz5ceiqy6-ck7e/S02aik3acny4-ejntw5ceiqy6k7e', 75, false, 6],
                4: ['B2cik3aek4ijkqr5ijny6-ci7/S01c2eik3-aeiq4aciqr5-airy6-ak8', 64, false, 5],
                5: ['B2ce3eknq4ik5-er6e78/S02ik3-ijq4acekryz5-cqry6ikn7', 77, false, 6],
                6: ['B2ce3eknq4ikq5-e6e78/S02ik3-ijq4acerwyz5-cjqy6ikn7', 78, false, 6],
                7: ['B2ce3eknq4ikrz5-en6ekn78/S02ik3-ijq4acekrw5-acny6ak7e', 67, true, 6],
                8: ['B2cek3ceny4irz5cjqry6-ac7/S02ik3-ceir4ckqrwy5-acr6akn7c8', 80, false, 6],
                9: ['B2ce3-aijy4ikryz5-aq6ck7/S02aik3aeqry4acknry5eikr6-ei7e', 81, false, 6],
                10: ['B2-an3-ciqr4iknrty5-akr6-en7c/S02-n3nry4-cenqt5acqy6ckn7e', 82, true, 7],
                11: ['B2cei3acen4-aew5ciknq6-in8/S02-c3cjnqy4-eqrt5cenr6acn7', 83, false, 6],
            }],
        ],
        3: [
            [12, {
                0: ['B2cik3ae4ikrtyz5cij6ekn7c/S01c2eik3-eiq4aijkr5ek6aci', 96, true, 8],
                1: ['B2cik3ae4ikrtyz5cij6aen7e/S01c2eik3-eikq4aijkr5ekr6aci', 85, true, 7],
                2: ['B2cik3aek4irty5inr6akn7c/S01c2eik3-eiq4aijr5-ny6in7c', 86, true, 7],
                3: ['B2cik3ae4ikqrtyz5ir6-ci7/S01c2eik3-eiq4aijkqr5ejkn6-ek', 75, true, 6],
                4: ['B2cik3ae4ikrtyz5cij6aen7e/S01c2eik3-eiq4aijr5ek6aci', 76, true, 6],
                5: ['B2cik3aey4ikrz5cijn6akn7/S01c2eik3-eiq4aikz5ceikn6cik', 89, true, 7],
                6: ['B2cik3aey4irz5ijn6an7/S01c2eik3-eiq4aijkz5-aqy6-an8', 90, true, 7],
                7: ['B2cik3aey4ikrz5cijnr6kn7/S01c2eik3-eiq4aikqz5-ajqy6-en', 103, true, 8],
                8: ['B2cik3ae4iqrz5cij6an7c/S01c2eik3cjkny4ijkrz5eknr6cin7c', 140, true, 10],
                9: ['B2cik3aey4ikryz5ijnr6an7e/S01c2eik3-eiq4aikz5-ajqy6-an7c', 81, true, 7],
                10: ['B2cik3aey4iqryz5cijn6an7e/S01c2eik3-eiq4aikqz5-aqy6-n', 94, true, 7],
                11: ['B2cik3ae4ikqrz5cijr6an7c/S01c2eik3cjkny4ijkqrz5ekqr6-ak7c', 83, true, 7],
            }],
        ],
        4: [
            [12, {
                0: ['B2cik3aeky4ijkrtz5in6n/S01c2eik3cjnry4ci5eik6ik7e', 60, true, 7],
                1: ['B2cik3aey4ijrtz5in6-ci7/S01c2eik3-aeiq4acikr5eijk6ci7c8', 121, true, 10],
                2: ['B2cik3aey4ijkrtyz5iny6aen7e/S01c2eik3-aeiq4acikz5eijkr6-ek8', 86, true, 8],
                3: ['B2cik3aey4ijkqrz5ir6en7/S01c2eik3-aeiq4aikrz5-jqy6cei7e8', 75, true, 7],
                4: ['B2cik3aek4ijrty5ir6aen7/S01c2eik3-eikq4aij5eknr6aci8', 88, true, 8],
                5: ['B2cik3aey4ijkqrz5ci6en7c/S01c2eik3-eiq4aik5-aqy6-en7e8', 89, true, 7],
                6: ['B2cik3aey4ijkrtyz5cijy6aen7e/S01c2eik3cjnry4acikz5eijkr6-ek8', 90, true, 8],
                7: ['B2cik3aey4ijqryz5ij6n7/S01c2eik3-eiqr4aikq5eikqr6cik8', 91, true, 8],
                8: ['B2cik3aey4ijkrtz5inr6-ci7c/S01c2eik3-aeiq4aikr5eijk6ci', 80, true, 7],
                9: ['B2cik3aek4ijkrty5i6aen7/S01c2eik3-eikq4aijkz5eknr6-kn8', 81, true, 7],
                10: ['B2ci3aey4ijkqrtz5ijn6n7/S01c2eik3-aeiq4aik5-aiqy6-en7e', 106, true, 9],
                11: ['B2ci3aey4ijkqrtz5cijnr6n7/S01c2eik3-eiq4aik5-aiqy6-ae78', 107, true, 9],
            }],
        ],
        5: [
            [12, {
                0: ['B2cik3aek4ir5ijny6akn/S01c2eik3-eiq4cijkrz5cekq6-ce7e8', 108, true, 9],
                1: ['B2cik3aek4ir5ijry6n7c/S01c2eik3-aeiq4cijkq5ceikq6ik78', 121, true, 10],
                2: ['B2cik3ae4iryz5ciy6akn/S01c2eik3cjnry4aciqr5-jny6ai8', 110, true, 9],
                3: ['B2cik3aek4irz5iy6-ci7c/S01c2eik3-aeiq4cijkr5ceikr6aik7e8', 111, true, 9],
                4: ['B2cik3aek4iqr5ijy6kn/S01c2eik3-aeiq4cik5cekqr6ik7e8', 100, true, 9],
                5: ['B2cik3aek4iry5ciny6an/S01c2eik3-aeiq4cijkr5-aqy6ik7e8', 101, true, 8],
                6: ['B2cik3aek4irz5ciy6an/S01c2eik3-eiq4cijkrz5cejk6ik7e8', 114, true, 10],
                7: ['B2cik3aey4ijkry5i6n7/S01c2eik3acjny4aijk5-ajny6ik7c8', 91, true, 8],
                8: ['B2cik3aek4ir5inry6n/S01c2eik3-aeiq4cikr5-aqry6ik7e8', 104, true, 9],
                9: ['B2cik3aek4iry5ijny6akn/S01c2eik3-aeiq4cijkrz5cekq6-c7e8', 105, true, 9],
                10: ['B2cik3aek4iry5inry6akn/S01c2eik3-aeiq4cijkz5cejkq6-ce78', 118, true, 10],
                11: ['B2cik3aey4ijkry5cij6n7/S01c2eik3acjny4aik5-cjny6-e7c', 95, true, 8],
            }],
        ],
        6: [
            [60, {
                32: ['B2cik3aey4aijry5cijry6an7e/S01c2ei3-eiqr4iqt5ek6ik7c8', 92, true, 9],
            }],
        ]
    },

    isValidSpeed(dx: number, dy: number, period: number): boolean {
        if (!(dx in this.rules && dy === 0)) {
            return false;
        }
        for (let [mod, value] of this.rules[dx]) {
            let modPeriod = period % mod;
            if (modPeriod in value && period >= value[modPeriod][1]) {
                return true;
            }
        }
        return false;
    },

    minPopulation(dx: number, dy: number, period: number): number | null {
        return this.isValidSpeed(dx, dy, period) ? 3 : null;
    },

    createShip(dx: number, dy: number, period: number): Pattern | null {
        if (!(dx in this.rules) || dy === 0) {
            return null;
        }
        for (let [mod, value] of this.rules[dx]) {
            let modPeriod = period % mod;
            if (modPeriod in value && period >= value[modPeriod][1]) {
                let spec = value[modPeriod];
                let p = createPattern(spec[0]) as DataPattern;
                if (spec[2]) {
                    let height = 3;
                    let width = spec[3] + (period - spec[1]) / 12 + 2;
                    let data = new Uint8Array(height * width);
                    data[width - 1] = 1;
                    data[width] = 1;
                    data[3 * width - 1] = 1;
                    p.setData(height, width, data);
                } else {
                    let height = 1;
                    let width = spec[3] + (period - spec[1]) / 12 + 4;
                    let data = new Uint8Array(height * width);
                    data[0] = 1;
                    data[width - 3] = 1;
                    data[width - 1] = 1;
                    p.setData(height, width, data);
                }
                return p;
            }
        }
        return null;
    },

};


export const INT_ADJUSTABLES: AdjustableGenerator[] = [QUAD_WICKSTRETCHER];
