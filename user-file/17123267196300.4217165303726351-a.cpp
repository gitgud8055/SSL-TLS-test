#include<bits/stdc++.h>

using namespace std;

#define double long double

vector<double> operator * (vector<double> a, vector<double> b) {
	vector<double> c(a.size() + b.size() - 1);
	for (int i = 1; i < a.size(); i++) {
		for (int j = 1; j < b.size(); j++) {
			c[i + j] += a[i] * b[j];
		}
	}
	return c;
}

vector<double> pow(vector<double> a, int b) {
	if (b == 1) return a;
	vector<double> res = pow(a, b >> 1);
	res = res * res;
	if (b & 1) res = res * a;
	return res;
}

int main() {
	ios::sync_with_stdio(0);
	cin.tie(0);
	vector<double> a(7);
	for (int i = 1; i < 7; i++) a[i] = 1.0/6;
	vector<double> ans = pow(a, 260);
	vector<double> res(26, 0);
	for (int i = 1; i < (int) ans.size(); i++) {
		res[i % 26] += ans[i];
	}
	cout << fixed << setprecision(15);
	for (auto&x : res) cout << x <<" ";
} 
